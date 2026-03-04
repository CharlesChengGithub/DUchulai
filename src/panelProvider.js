const vscode = require('vscode');

function createPanel(context, messageHandler, onDispose, tempDir) {
    const localResourceRoots = [
        vscode.Uri.file(context.extensionPath)
    ];
    if (tempDir) {
        localResourceRoots.push(vscode.Uri.file(tempDir));
    }

    const panel = vscode.window.createWebviewPanel(
        'nineneedles',
        '读出来',
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots
        }
    );

    panel.webview.html = getWebviewContent();

    panel.webview.onDidReceiveMessage(
        message => messageHandler(message),
        undefined,
        context.subscriptions
    );

    panel.onDidDispose(() => {
        if (onDispose) onDispose();
    }, undefined, context.subscriptions);

    return panel;
}

function getWebviewContent() {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>读出来</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            user-select: none;
        }

        .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 14px;
            border-bottom: 1px solid var(--vscode-widget-border, #404040);
        }

        .header h1 {
            font-size: 18px;
            font-weight: 600;
        }

        .progress-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .progress-bar-container {
            width: 100%;
            height: 6px;
            background: var(--vscode-progressBar-background, #333);
            border-radius: 3px;
            margin-bottom: 16px;
            cursor: pointer;
        }

        .progress-bar {
            height: 100%;
            background: var(--vscode-button-background, #0078d4);
            border-radius: 3px;
            transition: width 0.3s ease;
        }

        .text-display {
            background: var(--vscode-input-background, #1e1e1e);
            border: 1px solid var(--vscode-input-border, #404040);
            border-radius: 6px;
            padding: 14px;
            margin-bottom: 20px;
            min-height: 100px;
            max-height: 200px;
            overflow-y: auto;
            font-size: 14px;
            line-height: 1.8;
            color: var(--vscode-editor-foreground);
            user-select: text;
        }

        .text-display .placeholder {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        .controls {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
        }

        .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.12s ease;
            background: var(--vscode-button-secondaryBackground, #3a3a3a);
            color: var(--vscode-button-secondaryForeground, #ccc);
        }

        .btn:hover {
            background: var(--vscode-button-secondaryHoverBackground, #454545);
            transform: scale(1.06);
        }

        .btn:active { transform: scale(0.94); }

        .btn-sm { width: 34px; height: 34px; font-size: 14px; }
        .btn-md { width: 40px; height: 40px; font-size: 16px; }

        .btn-lg {
            width: 52px;
            height: 52px;
            font-size: 22px;
            background: var(--vscode-button-background, #0078d4);
            color: var(--vscode-button-foreground, #fff);
            border-radius: 50%;
        }

        .btn-lg:hover {
            background: var(--vscode-button-hoverBackground, #106ebe);
        }

        .stop-row {
            display: flex;
            justify-content: center;
            margin-bottom: 20px;
        }

        .btn-stop {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 20px;
            border: 1px solid var(--vscode-button-secondaryBackground, #555);
            border-radius: 16px;
            background: transparent;
            color: var(--vscode-foreground);
            cursor: pointer;
            font-size: 13px;
            transition: all 0.12s ease;
        }

        .btn-stop:hover {
            background: var(--vscode-button-secondaryBackground, #333);
        }

        .speed-section { margin-bottom: 16px; }

        .speed-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
            display: block;
        }

        .speed-control {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
        }

        .speed-adj-btn {
            width: 34px;
            height: 34px;
            border: 1px solid var(--vscode-button-secondaryBackground, #555);
            border-radius: 50%;
            background: transparent;
            color: var(--vscode-foreground);
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.12s ease;
        }

        .speed-adj-btn:hover {
            background: var(--vscode-button-secondaryBackground, #333);
            transform: scale(1.06);
        }

        .speed-adj-btn:active { transform: scale(0.94); }

        .speed-adj-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
            transform: none;
        }

        .speed-value {
            font-size: 20px;
            font-weight: 600;
            min-width: 60px;
            text-align: center;
            color: var(--vscode-foreground);
        }

        .speed-reset {
            padding: 3px 10px;
            border: 1px solid var(--vscode-button-secondaryBackground, #555);
            border-radius: 10px;
            background: transparent;
            color: var(--vscode-descriptionForeground);
            cursor: pointer;
            font-size: 11px;
            transition: all 0.12s ease;
        }

        .speed-reset:hover {
            background: var(--vscode-button-secondaryBackground, #333);
        }

        .status {
            text-align: center;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .status .state {
            display: inline-block;
            padding: 2px 12px;
            border-radius: 10px;
            background: var(--vscode-badge-background, #404040);
            color: var(--vscode-badge-foreground, #fff);
            font-size: 11px;
        }

        .status .state.playing { background: #2ea043; }
        .status .state.paused { background: #d29922; }
        .status .state.loading { background: #1f6feb; }
    </style>
</head>
<body>
    <div class="header">
        <h1>读出来</h1>
    </div>

    <div class="progress-info">
        <span id="segmentInfo">段落 0 / 0</span>
        <span id="percentInfo">0%</span>
    </div>
    <div class="progress-bar-container" id="progressContainer">
        <div class="progress-bar" id="progressBar" style="width:0%"></div>
    </div>

    <div class="text-display" id="textDisplay">
        <span class="placeholder">点击播放按钮开始朗读...</span>
    </div>

    <div class="controls">
        <button class="btn btn-sm" id="btnStart" title="回到开头">⏮</button>
        <button class="btn btn-md" id="btnPrev" title="上一段">⏪</button>
        <button class="btn btn-lg" id="btnPlayPause" title="播放">▶</button>
        <button class="btn btn-md" id="btnNext" title="下一段">⏩</button>
        <button class="btn btn-sm" id="btnEnd" title="跳到末尾">⏭</button>
    </div>

    <div class="stop-row">
        <button class="btn-stop" id="btnStop" title="停止">⏹ 停止</button>
    </div>

    <div class="speed-section">
        <span class="speed-label">朗读速度</span>
        <div class="speed-control">
            <button class="speed-adj-btn" id="btnSpeedDown" title="减速 -0.25">\u2212</button>
            <span class="speed-value" id="speedValue">1.00x</span>
            <button class="speed-adj-btn" id="btnSpeedUp" title="加速 +0.25">+</button>
            <button class="speed-reset" id="btnSpeedReset" title="恢复默认">重置</button>
        </div>
    </div>

    <div class="status">
        <span class="state" id="statusText">就绪</span>
    </div>

    <audio id="audioPlayer" style="display:none"></audio>

    <script>
        const vscode = acquireVsCodeApi();
        const audioPlayer = document.getElementById('audioPlayer');

        const btnPlayPause = document.getElementById('btnPlayPause');
        const btnPrev = document.getElementById('btnPrev');
        const btnNext = document.getElementById('btnNext');
        const btnStart = document.getElementById('btnStart');
        const btnEnd = document.getElementById('btnEnd');
        const btnStop = document.getElementById('btnStop');
        const btnSpeedDown = document.getElementById('btnSpeedDown');
        const btnSpeedUp = document.getElementById('btnSpeedUp');
        const btnSpeedReset = document.getElementById('btnSpeedReset');
        const speedValue = document.getElementById('speedValue');
        const textDisplay = document.getElementById('textDisplay');
        const segmentInfo = document.getElementById('segmentInfo');
        const percentInfo = document.getElementById('percentInfo');
        const progressBar = document.getElementById('progressBar');
        const progressContainer = document.getElementById('progressContainer');
        const statusText = document.getElementById('statusText');

        let state = {
            isPlaying: false,
            isPaused: false,
            isLoading: false,
            currentIndex: 0,
            totalSegments: 0,
            speed: 1.0,
            currentText: ''
        };

        audioPlayer.addEventListener('ended', () => {
            vscode.postMessage({ command: 'audioEnded' });
        });

        audioPlayer.addEventListener('error', (e) => {
            const err = audioPlayer.error;
            const detail = err ? err.code + ': ' + err.message : 'unknown';
            vscode.postMessage({ command: 'audioError', message: detail });
        });

        btnPlayPause.addEventListener('click', () => {
            if (state.isPlaying && !state.isPaused) {
                vscode.postMessage({ command: 'pause' });
            } else {
                vscode.postMessage({ command: 'play' });
            }
        });

        btnPrev.addEventListener('click', () => vscode.postMessage({ command: 'prev' }));
        btnNext.addEventListener('click', () => vscode.postMessage({ command: 'next' }));
        btnStart.addEventListener('click', () => vscode.postMessage({ command: 'goToStart' }));
        btnEnd.addEventListener('click', () => vscode.postMessage({ command: 'goToEnd' }));
        btnStop.addEventListener('click', () => vscode.postMessage({ command: 'stop' }));

        const SPEED_MIN = 0.25;
        const SPEED_MAX = 3.0;
        const SPEED_STEP = 0.25;

        btnSpeedDown.addEventListener('click', () => {
            const newSpeed = Math.round((state.speed - SPEED_STEP) * 100) / 100;
            if (newSpeed >= SPEED_MIN) {
                vscode.postMessage({ command: 'setSpeed', value: newSpeed });
            }
        });

        btnSpeedUp.addEventListener('click', () => {
            const newSpeed = Math.round((state.speed + SPEED_STEP) * 100) / 100;
            if (newSpeed <= SPEED_MAX) {
                vscode.postMessage({ command: 'setSpeed', value: newSpeed });
            }
        });

        btnSpeedReset.addEventListener('click', () => {
            vscode.postMessage({ command: 'setSpeed', value: 1.0 });
        });

        progressContainer.addEventListener('click', (e) => {
            if (state.totalSegments === 0) return;
            const rect = progressContainer.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            const idx = Math.floor(pct * state.totalSegments);
            vscode.postMessage({ command: 'jumpTo', value: Math.max(0, Math.min(idx, state.totalSegments - 1)) });
        });

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'state':
                    state = message.data;
                    updateUI();
                    break;
                case 'playAudio':
                    audioPlayer.src = message.uri;
                    audioPlayer.playbackRate = message.speed || 1.0;
                    audioPlayer.play().catch(() => {});
                    break;
                case 'pauseAudio':
                    audioPlayer.pause();
                    break;
                case 'resumeAudio':
                    audioPlayer.play().catch(() => {});
                    break;
                case 'setSpeed':
                    audioPlayer.playbackRate = message.value;
                    break;
                case 'stopAudio':
                    audioPlayer.pause();
                    audioPlayer.removeAttribute('src');
                    audioPlayer.load();
                    break;
            }
        });

        function updateUI() {
            if (state.currentText) {
                textDisplay.textContent = state.currentText;
            } else {
                textDisplay.innerHTML = '<span class="placeholder">点击播放按钮开始朗读...</span>';
            }

            segmentInfo.textContent = '段落 ' + (state.totalSegments > 0 ? state.currentIndex + 1 : 0) + ' / ' + state.totalSegments;
            const pct = state.totalSegments > 0 ? Math.round(((state.currentIndex + 1) / state.totalSegments) * 100) : 0;
            percentInfo.textContent = pct + '%';
            progressBar.style.width = pct + '%';

            if (state.isPlaying && !state.isPaused) {
                btnPlayPause.textContent = '⏸';
                btnPlayPause.title = '暂停';
            } else {
                btnPlayPause.textContent = '▶';
                btnPlayPause.title = '播放';
            }

            if (state.isLoading) {
                statusText.textContent = '生成语音中...';
                statusText.className = 'state loading';
            } else if (state.isPlaying && !state.isPaused) {
                statusText.textContent = '朗读中';
                statusText.className = 'state playing';
            } else if (state.isPaused) {
                statusText.textContent = '已暂停';
                statusText.className = 'state paused';
            } else {
                statusText.textContent = '就绪';
                statusText.className = 'state';
            }

            speedValue.textContent = state.speed.toFixed(2) + 'x';
            btnSpeedDown.disabled = state.speed <= 0.25;
            btnSpeedUp.disabled = state.speed >= 3.0;
        }

        vscode.postMessage({ command: 'getState' });
    </script>
</body>
</html>`;
}

module.exports = { createPanel };
