const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['src/extension.js'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node16',
    sourcemap: false,
    minify: true,
    plugins: [{
        name: 'ignore-optional-deps',
        setup(build) {
            // Stub out canvas and other optional deps that pdfjs-dist may try to load
            build.onResolve({ filter: /^(canvas|path2d-polyfill|path2d)$/ }, () => ({
                path: 'stub',
                namespace: 'ignore',
            }));
            build.onLoad({ filter: /.*/, namespace: 'ignore' }, () => ({
                contents: 'module.exports = {};',
            }));
        }
    }]
}).then(() => {
    console.log('Build succeeded');
}).catch(() => process.exit(1));
