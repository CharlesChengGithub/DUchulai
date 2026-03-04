const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const path = require('path');
const fs = require('fs');
const os = require('os');

class TtsEngine {
    constructor() {
        this.tts = null;
        this.tempDir = path.join(os.tmpdir(), 'nineneedles-tts');
        this._ensureTempDir();
    }

    _ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async _getTts() {
        if (!this.tts) {
            this.tts = new MsEdgeTTS();
            await this.tts.setMetadata('zh-CN-XiaoxiaoNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
        }
        return this.tts;
    }

    async generate(text) {
        try {
            const tts = await this._getTts();
            this._ensureTempDir();
            const result = await tts.toFile(this.tempDir, text);

            // v2 toFile always writes to audio.mp3, rename to unique file
            const uniquePath = path.join(this.tempDir, `tts_${Date.now()}.mp3`);
            fs.renameSync(result.audioFilePath, uniquePath);

            const stat = fs.statSync(uniquePath);
            if (stat.size === 0) {
                throw new Error('生成的音频文件为空');
            }
            return uniquePath;
        } catch (err) {
            this.tts = null;
            if (err instanceof Error) throw err;
            throw new Error(typeof err === 'string' ? err : JSON.stringify(err));
        }
    }

    dispose() {
        if (this.tts) {
            try { this.tts.close(); } catch (e) { /* ignore */ }
            this.tts = null;
        }
        try {
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir);
                for (const file of files) {
                    try {
                        fs.unlinkSync(path.join(this.tempDir, file));
                    } catch (e) { /* ignore */ }
                }
                try {
                    fs.rmdirSync(this.tempDir);
                } catch (e) { /* ignore */ }
            }
        } catch (e) { /* ignore */ }
    }
}

module.exports = { TtsEngine };
