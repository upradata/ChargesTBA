import { spawn, execFileSync } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

execFileSync(pnpm, ['run', 'build'], { stdio: 'inherit' });

const processes = [
    spawn(pnpm, ['exec', 'tsc', '--watch', '--preserveWatchOutput'], { stdio: 'inherit' }),
    spawn(pnpm, ['exec', 'clasp', 'push', '--watch'], { stdio: 'inherit' }),
];

let stopping = false;

const stop = exitCode => {
    if (stopping) {
        return;
    }
    stopping = true;
    process.exitCode = exitCode;
    for (const child of processes) {
        if (child.exitCode === null) {
            child.kill('SIGTERM');
        }
    }
};

for (const child of processes) {
    child.on('error', error => {
        console.error(error);
        stop(1);
    });
    child.on('exit', code => {
        if (!stopping) {
            stop(code ?? 1);
        }
    });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
