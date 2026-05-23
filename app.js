// Vocabulary Application Logic
document.addEventListener('DOMContentLoaded', () => {
    // 1. App State
    let selectedUnits = [1]; // Default to Unit 1
    let studyMode = 'flashcards'; // 'flashcards' | 'quiz'
    let wordLimit = 5; // Default to 5 words trial
    let currentWords = [];
    let currentIndex = 0;
    let results = []; // Array tracking {word, status: 'known' | 'review'}
    let hasAnsweredQuiz = false;
    let startTime = null;
    let isFlippedCurrent = false;

    // Unit Title mapper (convenient displaying)
    const unitTitles = {
        1: "Leisure time",
        2: "Life on countryside",
        3: "Teenagers",
        4: "Ethnic groups of VN",
        5: "Customs & Traditions",
        6: "Lifestyle",
        7: "Environmental protection",
        8: "Shopping",
        9: "Natural disasters",
        10: "Future Communication",
        11: "Science & Tech",
        12: "Life on other planets"
    };

    // 2. UI Elements
    const screenSetup = document.getElementById('screen-setup');
    const screenFlashcards = document.getElementById('screen-flashcards');
    const screenQuiz = document.getElementById('screen-quiz');
    const screenResult = document.getElementById('screen-result');

    const unitContainer = document.getElementById('unit-selection-container');
    const btnStart = document.getElementById('btn-start');
    const studentNameInput = document.getElementById('student-name');
    
    // Config panel buttons
    const modeButtons = document.querySelectorAll('[data-mode]');
    const limitButtons = document.querySelectorAll('[data-limit]');

    // Flashcard Elements
    const fcProgressText = document.getElementById('fc-progress-text');
    const fcPercentage = document.getElementById('fc-percentage');
    const fcProgressFill = document.getElementById('fc-progress-fill');
    const vocabCard = document.getElementById('vocab-card');
    const fcPos = document.getElementById('fc-pos');
    const fcWord = document.getElementById('fc-word');
    const fcPron = document.getElementById('fc-pron');
    const fcMeaning = document.getElementById('fc-meaning');
    const fcUsage = document.getElementById('fc-usage');
    const fcExample = document.getElementById('fc-example');
    const fcTranslation = document.getElementById('fc-translation');
    const btnSpeak = document.getElementById('btn-speak');
    const btnReviewAgain = document.getElementById('btn-review-again');
    const btnReviewKnown = document.getElementById('btn-review-known');
    const btnFcQuit = document.getElementById('btn-fc-quit');
    const btnSpeakExample = document.getElementById('btn-speak-example');

    // Quiz Elements
    const quizProgressText = document.getElementById('quiz-progress-text');
    const quizPercentage = document.getElementById('quiz-percentage');
    const quizProgressFill = document.getElementById('quiz-progress-fill');
    const quizPos = document.getElementById('quiz-pos');
    const quizQuestionWord = document.getElementById('quiz-question-word');
    const quizOptionsContainer = document.getElementById('quiz-options-container');
    const btnQuizQuit = document.getElementById('btn-quiz-quit');

    // Results Elements
    const resTotalKnown = document.getElementById('res-total-known');
    const resTotalReview = document.getElementById('res-total-review');
    const resScorePct = document.getElementById('res-score-pct');
    const resProgressFill = document.getElementById('res-progress-fill');
    const resultWordList = document.getElementById('result-word-list');
    const btnRestart = document.getElementById('btn-restart');
    const btnResultHome = document.getElementById('btn-result-home');
    const resStudentName = document.getElementById('res-student-name');
    const resSubmitTime = document.getElementById('res-submit-time');
    const resDuration = document.getElementById('res-duration');

    // 3. Initialize setup panel
    function initSetup() {
        // Clear container
        unitContainer.innerHTML = '';
        
        // Count words per unit
        const unitCounts = {};
        VOCABULARY_DB.forEach(w => {
            unitCounts[w.unit] = (unitCounts[w.unit] || 0) + 1;
        });

        // Add buttons for Unit 1 to 12
        for (let u = 1; u <= 12; u++) {
            const btn = document.createElement('button');
            btn.className = `unit-btn ${selectedUnits.includes(u) ? 'active' : ''}`;
            btn.dataset.unit = u;
            btn.innerHTML = `
                <div style="font-weight: 700;">U${u}</div>
                <div style="font-size: 0.65rem; opacity: 0.8; margin-top: 2px;">${unitCounts[u] || 0} từ</div>
            `;
            
            btn.addEventListener('click', () => {
                if (selectedUnits.includes(u)) {
                    // Prevent deselecting all
                    if (selectedUnits.length > 1) {
                        selectedUnits = selectedUnits.filter(x => x !== u);
                        btn.classList.remove('active');
                    }
                } else {
                    selectedUnits.push(u);
                    btn.classList.add('active');
                }
            });
            unitContainer.appendChild(btn);
        }
    }

    // Toggle Learning Mode Config
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            studyMode = btn.dataset.mode;
        });
    });

    // Toggle Slicing Limit Config
    limitButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            limitButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const limVal = btn.dataset.limit;
            wordLimit = parseInt(limVal);
        });
    });

    // 4. State Navigators
    function showScreen(screen) {
        screenSetup.classList.add('hidden');
        screenFlashcards.classList.add('hidden');
        screenQuiz.classList.add('hidden');
        screenResult.classList.add('hidden');
        
        screen.classList.remove('hidden');
    }

    // Helper: TTS speaker
    function speakWord(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Stop any running speech
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.85; // slightly slower for students
            window.speechSynthesis.speak(utterance);
        }
    }

    btnSpeak.addEventListener('click', (e) => {
        e.stopPropagation(); // Avoid card flip
        const w = currentWords[currentIndex];
        if (w) speakWord(w.word);
    });

    btnSpeakExample.addEventListener('click', (e) => {
        e.stopPropagation(); // Avoid card flip
        const w = currentWords[currentIndex];
        if (w && w.examples) {
            // Speak the English example sentence, ignore Vietnamese translation in parentheses
            const parts = w.examples.split('(');
            speakWord(parts[0].trim());
        }
    });

    // 5. Study Engine Initiator
    btnStart.addEventListener('click', () => {
        // Filter DB
        let filtered = VOCABULARY_DB.filter(w => selectedUnits.includes(w.unit));
        
        if (filtered.length === 0) {
            alert("Vui lòng chọn Unit có chứa từ vựng!");
            return;
        }

        // Shuffle
        filtered = filtered.sort(() => 0.5 - Math.random());

        // Limit
        const actualLimit = Math.min(wordLimit, filtered.length);
        currentWords = filtered.slice(0, actualLimit);
        
        // Capture Student Name & Start Time
        const studentName = studentNameInput.value.trim() || "Học sinh tự do";
        resStudentName.innerText = `Học sinh: ${studentName}`;
        startTime = Date.now();
        
        // Reset progress counters
        currentIndex = 0;
        results = [];

        if (studyMode === 'flashcards') {
            showScreen(screenFlashcards);
            loadFlashcard();
        } else {
            showScreen(screenQuiz);
            loadQuizQuestion();
        }
    });

    // 6. Flashcard study mode
    function loadFlashcard() {
        // Reset card flip & blocked state
        vocabCard.classList.remove('flipped');
        isFlippedCurrent = false;
        
        // Disable "Đã thuộc" until card is flipped
        btnReviewKnown.disabled = true;
        btnReviewKnown.style.opacity = '0.4';
        btnReviewKnown.style.pointerEvents = 'none';
        
        const w = currentWords[currentIndex];
        if (!w) {
            finishStudy();
            return;
        }

        // Progress UI
        const total = currentWords.length;
        const currentNum = currentIndex + 1;
        const pct = Math.round((currentIndex / total) * 100);
        
        fcProgressText.innerText = `Từ ${currentNum} / ${total}`;
        fcPercentage.innerText = `${pct}%`;
        fcProgressFill.style.width = `${pct}%`;

        // Card front
        fcWord.innerText = w.word;
        fcPron.innerText = w.pron || 'N/A';
        fcPos.innerText = w.pos || 'N/A';

        // Card back
        fcMeaning.innerText = w.meaning;
        fcUsage.innerText = w.usage || 'Chưa có thông tin sử dụng.';
        
        // Example check
        if (w.examples) {
            // Split example and translation from the parsed field
            // E.g., "In my leisure time... (Trong thời gian...)"
            const parts = w.examples.split('(');
            fcExample.innerText = parts[0].trim();
            if (parts.length > 1) {
                fcTranslation.innerText = '(' + parts[1];
                fcTranslation.style.display = 'block';
            } else {
                fcTranslation.style.display = 'none';
            }
            fcExample.parentElement.style.display = 'block';
        } else {
            fcExample.parentElement.style.display = 'none';
        }

        // Speak word automatically on load
        setTimeout(() => {
            speakWord(w.word);
        }, 300);
    }

    // Flip action
    vocabCard.addEventListener('click', () => {
        vocabCard.classList.toggle('flipped');
        
        // Enable "Đã thuộc" once flipped
        if (!isFlippedCurrent) {
            isFlippedCurrent = true;
            btnReviewKnown.disabled = false;
            btnReviewKnown.style.opacity = '1';
            btnReviewKnown.style.pointerEvents = 'auto';
        }
        
        // Auto-play example sentence TTS when flipped to show the back
        if (vocabCard.classList.contains('flipped')) {
            const w = currentWords[currentIndex];
            if (w && w.examples) {
                setTimeout(() => {
                    const parts = w.examples.split('(');
                    speakWord(parts[0].trim());
                }, 400); // 400ms fits the flipping animation transit time
            }
        }
    });

    // Buttons
    btnReviewKnown.addEventListener('click', () => {
        results.push({ word: currentWords[currentIndex], status: 'known' });
        nextWord();
    });

    btnReviewAgain.addEventListener('click', () => {
        results.push({ word: currentWords[currentIndex], status: 'review' });
        nextWord();
    });

    function nextWord() {
        currentIndex++;
        if (currentIndex >= currentWords.length) {
            finishStudy();
        } else {
            loadFlashcard();
        }
    }

    btnFcQuit.addEventListener('click', () => {
        if (confirm("Bạn muốn dừng buổi học này?")) {
            showScreen(screenSetup);
        }
    });

    // 7. Quiz Study Mode
    function loadQuizQuestion() {
        hasAnsweredQuiz = false;
        const w = currentWords[currentIndex];
        if (!w) {
            finishStudy();
            return;
        }

        // Progress UI
        const total = currentWords.length;
        const currentNum = currentIndex + 1;
        const pct = Math.round((currentIndex / total) * 100);
        
        quizProgressText.innerText = `Câu hỏi ${currentNum} / ${total}`;
        quizPercentage.innerText = `${pct}%`;
        quizProgressFill.style.width = `${pct}%`;

        // Question Details
        quizQuestionWord.innerText = w.word;
        quizPos.innerText = w.pos || 'N/A';

        // Auto speak question word
        speakWord(w.word);

        // Clean meaning text for quiz (remove the word prefix to avoid giving away the answer)
        function cleanMeaningForQuiz(text) {
            if (!text) return "";
            let cleaned = text.replace(/^["'“‘”’]*[^"'“‘”’]+["'“‘”’]*\s*(\(hoặc cụm.*?\))?\s*có nghĩa là\s*/i, '');
            cleaned = cleaned.trim();
            if (cleaned) {
                cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
            }
            return cleaned;
        }

        // Options pool generation
        // 1 correct meaning
        // 3 distractors from all vocabulary DB
        let distractors = VOCABULARY_DB.filter(x => x.word.toLowerCase() !== w.word.toLowerCase());
        distractors = distractors.sort(() => 0.5 - Math.random()).slice(0, 3);

        const options = [
            { text: cleanMeaningForQuiz(w.meaning), correct: true },
            ...distractors.map(d => ({ text: cleanMeaningForQuiz(d.meaning), correct: false }))
        ];

        // Shuffle options
        const shuffledOptions = options.sort(() => 0.5 - Math.random());

        // Clear container and append buttons
        quizOptionsContainer.innerHTML = '';
        shuffledOptions.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = opt.text;
            
            btn.addEventListener('click', () => {
                if (hasAnsweredQuiz) return;
                hasAnsweredQuiz = true;

                // Highlight correct and incorrect
                if (opt.correct) {
                    btn.classList.add('correct');
                    results.push({ word: w, status: 'known' });
                } else {
                    btn.classList.add('incorrect');
                    results.push({ word: w, status: 'review' });
                    
                    // Reveal the correct one in green
                    Array.from(quizOptionsContainer.children).forEach(sibling => {
                        if (shuffledOptions[Array.from(quizOptionsContainer.children).indexOf(sibling)].correct) {
                            sibling.classList.add('correct');
                        }
                    });
                }

                // Wait 1.5s then advance
                setTimeout(() => {
                    currentIndex++;
                    if (currentIndex >= currentWords.length) {
                        finishStudy();
                    } else {
                        loadQuizQuestion();
                    }
                }, 1500);
            });
            
            quizOptionsContainer.appendChild(btn);
        });
    }

    btnQuizQuit.addEventListener('click', () => {
        if (confirm("Bạn muốn dừng câu hỏi trắc nghiệm?")) {
            showScreen(screenSetup);
        }
    });

    // 8. Summary & Finish Screen
    function finishStudy() {
        showScreen(screenResult);

        // Calculate time details
        const endTime = Date.now();
        const diffMs = endTime - startTime;
        const diffSecs = Math.round(diffMs / 1000);
        let durationStr = "";
        if (diffSecs >= 60) {
            const mins = Math.floor(diffSecs / 60);
            const secs = diffSecs % 60;
            durationStr = `${mins} phút ${secs} giây`;
        } else {
            durationStr = `${diffSecs} giây`;
        }
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const submitTimeStr = `${timeStr} - ${dateStr}`;
        
        resSubmitTime.innerHTML = `Thời điểm nộp: <strong style="color: var(--text-primary); font-weight: 600;">${submitTimeStr}</strong>`;
        resDuration.innerHTML = `Thời lượng làm bài: <strong style="color: var(--text-primary); font-weight: 600;">${durationStr}</strong>`;

        const known = results.filter(r => r.status === 'known').length;
        const review = results.filter(r => r.status === 'review').length;
        const total = currentWords.length;
        const scorePct = total > 0 ? Math.round((known / total) * 100) : 0;

        resTotalKnown.innerText = known;
        resTotalReview.innerText = review;
        resScorePct.innerText = `${scorePct}%`;
        resProgressFill.style.width = `${scorePct}%`;

        // Render word breakdown list
        resultWordList.innerHTML = '';
        results.forEach(res => {
            const item = document.createElement('div');
            item.className = `result-list-item ${res.status === 'known' ? 'correct' : 'incorrect'}`;
            
            const isKnown = res.status === 'known';
            item.innerHTML = `
                <div>
                    <strong style="color: ${isKnown ? 'var(--success-color)' : 'var(--error-color)'};">${res.word.word}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 6px;">[${res.word.pron}]</span>
                    <div style="font-size: 0.8rem; margin-top: 2px;">${res.word.meaning}</div>
                </div>
                <div>
                    ${isKnown ? `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success-color)" stroke-width="2.5">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    ` : `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--error-color)" stroke-width="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    `}
                </div>
            `;
            resultWordList.appendChild(item);
        });
    }

    // Restart actions
    btnRestart.addEventListener('click', () => {
        currentIndex = 0;
        results = [];
        startTime = Date.now(); // reset start time for the new run
        // Reshuffle the same subset of words
        currentWords = currentWords.sort(() => 0.5 - Math.random());
        
        if (studyMode === 'flashcards') {
            showScreen(screenFlashcards);
            loadFlashcard();
        } else {
            showScreen(screenQuiz);
            loadQuizQuestion();
        }
    });

    btnResultHome.addEventListener('click', () => {
        showScreen(screenSetup);
        initSetup();
    });

    // Run setup panel
    initSetup();
});
