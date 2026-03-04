const fs = require('fs');

async function extractText(filePath, type) {
    if (type === 'pdf') {
        return extractPdfText(filePath);
    }
    return fs.readFileSync(filePath, 'utf-8');
}

async function extractPdfText(filePath) {
    try {
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

        const data = new Uint8Array(fs.readFileSync(filePath));
        const doc = await pdfjsLib.getDocument({
            data: data,
            useSystemFonts: true,
        }).promise;

        let fullText = '';
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join('');
            fullText += pageText + '\n\n';
        }

        return fullText;
    } catch (err) {
        throw new Error('PDF解析失败: ' + err.message);
    }
}

function cleanMarkdown(text) {
    let cleaned = text;
    // Remove code blocks
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/`[^`]+`/g, '');
    // Remove heading markers but keep text
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
    // Remove bold/italic markers
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
    cleaned = cleaned.replace(/_([^_]+)_/g, '$1');
    // Remove links, keep text
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Remove HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, '');
    // Remove horizontal rules
    cleaned = cleaned.replace(/^[-*_]{3,}\s*$/gm, '');
    // Remove blockquote markers
    cleaned = cleaned.replace(/^>\s*/gm, '');
    // Remove list markers
    cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, '');
    cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, '');
    // Clean extra whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned.trim();
}

function splitIntoSegments(text) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const result = [];

    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (trimmed.length === 0) continue;

        if (trimmed.length > 500) {
            // Split long paragraphs by sentences
            const sentences = trimmed.split(/(?<=[。！？；.!?;])\s*/);
            let current = '';
            for (const sentence of sentences) {
                if (current.length + sentence.length > 400 && current.length > 0) {
                    result.push(current.trim());
                    current = sentence;
                } else {
                    current += (current ? '' : '') + sentence;
                }
            }
            if (current.trim()) {
                result.push(current.trim());
            }
        } else {
            result.push(trimmed);
        }
    }

    return result;
}

module.exports = { extractText, cleanMarkdown, splitIntoSegments };
