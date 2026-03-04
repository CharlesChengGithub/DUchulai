const vscode = require('vscode');
const { TtsEngine } = require('./ttsEngine');
const { extractText, cleanMarkdown, splitIntoSegments } = require('./textExtractor');
const { createPanel } = require('./panelProvider');

let ttsEngine = null;
let panel = null;
let segments = [];
let currentIndex = 0;
let isPlaying = false;
let isPaused = false;
let isLoading = false;
let currentSpeed = 1.0;

function updatePanel() {
    if (panel) {
        try {
            panel.webview.postMessage({
                type: 'state',
                data: {
                    isPlaying,
                    isPaused,
                    isLoading,
                    currentIndex,
                    totalSegments: segments.length,
                    speed: currentSpeed,
                    currentText: segments[currentIndex] || ''
                }
            });
        } catch (e) { /* panel may be disposed */ }
    }
}

async function playCurrentSegment() {
    if (currentIndex < 0 || currentIndex >= segments.length || !ttsEngine || !panel) return;

    isLoading = true;
    updatePanel();

    try {
        const filePath = await ttsEngine.generate(segments[currentIndex]);
        const fileUri = vscode.Uri.file(filePath);
        const webviewUri = panel.webview.asWebviewUri(fileUri);

        isLoading = false;
        isPlaying = true;
        isPaused = false;
        updatePanel();

        panel.webview.postMessage({
            type: 'playAudio',
            uri: webviewUri.toString(),
            speed: currentSpeed
        });
    } catch (err) {
        isLoading = false;
        isPlaying = false;
        updatePanel();
        const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
        vscode.window.showErrorMessage('读出来: 语音生成失败 - ' + errMsg);
    }
}

function stopReading() {
    isPlaying = false;
    isPaused = false;
    isLoading = false;
    if (panel) {
        try {
            panel.webview.postMessage({ type: 'stopAudio' });
        } catch (e) { /* ignore */ }
    }
    updatePanel();
}

function handlePanelMessage(message) {
    switch (message.command) {
        case 'play':
            if (segments.length === 0) return;
            if (isPaused) {
                isPaused = false;
                isPlaying = true;
                updatePanel();
                panel.webview.postMessage({ type: 'resumeAudio' });
            } else {
                playCurrentSegment();
            }
            break;

        case 'pause':
            if (isPlaying && !isPaused) {
                isPaused = true;
                updatePanel();
                panel.webview.postMessage({ type: 'pauseAudio' });
            }
            break;

        case 'stop':
            stopReading();
            break;

        case 'next':
            if (currentIndex < segments.length - 1) {
                currentIndex++;
                if (isPlaying) {
                    isPaused = false;
                    playCurrentSegment();
                } else {
                    updatePanel();
                }
            }
            break;

        case 'prev':
            if (currentIndex > 0) {
                currentIndex--;
                if (isPlaying) {
                    isPaused = false;
                    playCurrentSegment();
                } else {
                    updatePanel();
                }
            }
            break;

        case 'goToStart':
            currentIndex = 0;
            if (isPlaying) {
                isPaused = false;
                playCurrentSegment();
            } else {
                updatePanel();
            }
            break;

        case 'goToEnd':
            currentIndex = Math.max(0, segments.length - 1);
            if (isPlaying) {
                isPaused = false;
                playCurrentSegment();
            } else {
                updatePanel();
            }
            break;

        case 'setSpeed':
            currentSpeed = message.value;
            if (panel) {
                panel.webview.postMessage({ type: 'setSpeed', value: currentSpeed });
            }
            updatePanel();
            break;

        case 'jumpTo':
            if (message.value >= 0 && message.value < segments.length) {
                currentIndex = message.value;
                if (isPlaying) {
                    isPaused = false;
                    playCurrentSegment();
                } else {
                    updatePanel();
                }
            }
            break;

        case 'audioEnded':
            if (isPlaying && !isPaused) {
                currentIndex++;
                if (currentIndex < segments.length) {
                    playCurrentSegment();
                } else {
                    // Finished all segments
                    isPlaying = false;
                    currentIndex = segments.length - 1;
                    updatePanel();
                }
            }
            break;

        case 'audioError':
            isPlaying = false;
            isPaused = false;
            isLoading = false;
            updatePanel();
            vscode.window.showErrorMessage('读出来: 音频播放失败 - ' + (message.message || '未知错误'));
            break;

        case 'getState':
            updatePanel();
            break;
    }
}

async function startReading(context) {
    const editor = vscode.window.activeTextEditor;
    let text = '';
    let fileName = '';

    if (editor) {
        const doc = editor.document;
        fileName = doc.fileName;

        if (fileName.endsWith('.pdf')) {
            text = await extractText(fileName, 'pdf');
        } else {
            text = doc.getText();
        }
    } else {
        const tabGroups = vscode.window.tabGroups;
        if (tabGroups && tabGroups.activeTabGroup && tabGroups.activeTabGroup.activeTab) {
            const input = tabGroups.activeTabGroup.activeTab.input;
            if (input && input.uri) {
                const filePath = input.uri.fsPath;
                fileName = filePath;
                if (filePath.endsWith('.pdf')) {
                    text = await extractText(filePath, 'pdf');
                } else {
                    const content = await vscode.workspace.fs.readFile(input.uri);
                    text = Buffer.from(content).toString('utf-8');
                }
            }
        }
    }

    if (!text || text.trim().length === 0) {
        throw new Error('请先打开一个包含文本的Markdown或PDF文件');
    }

    if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) {
        text = cleanMarkdown(text);
    }

    segments = splitIntoSegments(text);

    if (segments.length === 0) {
        throw new Error('未找到可朗读的文本内容');
    }

    currentIndex = 0;
    isPlaying = false;
    isPaused = false;
    isLoading = false;

    if (!ttsEngine) {
        ttsEngine = new TtsEngine();
    }

    // Create or reveal panel
    if (!panel) {
        panel = createPanel(context, handlePanelMessage, () => {
            stopReading();
            panel = null;
        }, ttsEngine.tempDir);
    } else {
        panel.reveal(vscode.ViewColumn.Two);
    }

    updatePanel();
    vscode.window.showInformationMessage('读出来: 已加载 ' + segments.length + ' 个段落，点击面板中的播放按钮开始');
}

function activate(context) {
    const startCmd = vscode.commands.registerCommand('nineneedles.startReading', async () => {
        try {
            await startReading(context);
        } catch (err) {
            vscode.window.showErrorMessage('读出来: ' + err.message);
        }
    });

    const stopCmd = vscode.commands.registerCommand('nineneedles.stopReading', () => {
        stopReading();
    });

    context.subscriptions.push(startCmd, stopCmd);
}

function deactivate() {
    if (ttsEngine) {
        ttsEngine.dispose();
        ttsEngine = null;
    }
    panel = null;
}

module.exports = { activate, deactivate };
