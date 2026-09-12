import { type ExecFileOptions, execFile } from 'child_process';

export default function child(args: string[], complete: (error?: Error) => void, options?: ExecFileOptions): void {
  // Each child selects its own loaders; inheriting tsds's NODE_OPTIONS changes native resolution.
  execFile(process.execPath, args, { ...options, env: { ...process.env, NODE_OPTIONS: '', ...options?.env }, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) return complete(new Error(`${error.message}\n${stdout}\n${stderr}`));
    if (stdout.indexOf('mock-require-lazy integration complete') < 0) return complete(new Error(`Child did not complete its assertions.\n${stdout}\n${stderr}`));
    if (stderr) process.stderr.write(stderr);
    complete();
  });
}
