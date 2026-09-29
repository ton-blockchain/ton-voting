/** @jest-environment jsdom */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Cell } from '@ton/core';
import { response, votingResponses } from './helpers/toncenter';

const root = path.resolve(__dirname, '..');
let bundle: string;

beforeAll(() => {
    // Build in Node, then execute the actual browser bundle without Node globals.
    bundle = execFileSync(process.execPath, ['-e', `
        const result = require('esbuild').buildSync({
            entryPoints: ['dashboard/client.js'], bundle: true, write: false,
            platform: 'browser', format: 'iife', target: 'es2020',
            inject: ['dashboard/buffer-shim.ts'],
        });
        process.stdout.write(result.outputFiles[0].text);
    `], { cwd: root, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
});

beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    document.documentElement.innerHTML = readFileSync(path.join(root, 'dashboard/index.html'), 'utf8');
});

afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

it('resolves the current Telegram Wallet proposal as MTONGA with commit links on both diff sides', async () => {
    const fixture = votingResponses({
        hash: 'b2b46e5dba3272e93c0cd2a3c812f6767010b6c4e596d1e673b607b3364809d3',
        paramId: -123,
        value: Cell.fromBoc(readFileSync(path.join(__dirname, 'fixtures/telegram-wallet-key-rotation.boc')))[0],
        currentValue: Cell.fromBoc(readFileSync(path.join(__dirname, 'fixtures/telegram-wallet-rev00.boc')))[0],
    });
    window.fetch = jest.fn().mockResolvedValueOnce(response(fixture.account)).mockResolvedValueOnce(response(fixture.proposals));
    window.eval(bundle);
    await jest.advanceTimersByTimeAsync(1100);
    const proposal = document.querySelector('#proposal-list')!;
    expect(proposal.textContent).toContain('Add external-out for key rotation to Telegram Wallet');
    expect(proposal.textContent).toContain('MTONGA plan');
    expect(proposal.textContent).toContain('encryptedPrevPrivateKey');
    expect(proposal.textContent).toContain('different bytecode');
    expect(Array.from(proposal.querySelectorAll('.contract-code-source')).map((link) => link.getAttribute('href'))).toEqual([
        'https://github.com/ton-blockchain/tg-wallet-contract/commit/10a0d2b9e87bd0a5e9135c2431e3eb15c6a0485c',
        'https://github.com/ton-blockchain/tg-wallet-contract/commit/355c5f3beb1f5129902c4a72e2cecaeac985af29',
    ]);
});

it('renders client-side data, keeps it on 429 and recovers automatically', async () => {
    const fixture = votingResponses();
    const fetcher = jest.fn()
        .mockResolvedValueOnce(response(fixture.account))
        .mockResolvedValueOnce(response(fixture.proposals))
        .mockResolvedValueOnce(response(null, 429))
        .mockResolvedValueOnce(response(fixture.account))
        .mockResolvedValueOnce(response(fixture.proposals));
    window.fetch = fetcher;
    window.eval(bundle);
    await jest.advanceTimersByTimeAsync(1100);
    expect(document.querySelector('#proposal-counter')?.textContent).toBe('1 live proposal');
    expect(document.querySelector('#connection-status')?.textContent).toBe('');
    expect(document.querySelector('#proposal-list')?.textContent).toContain('Network version');
    const saved = localStorage.getItem('ton-config-voting:last-snapshot:v10');
    expect(saved).not.toBeNull();

    await jest.advanceTimersByTimeAsync(28_900);
    expect(document.querySelector('#connection-status')?.textContent).toContain('429');
    expect(document.querySelector('#connection-status')?.textContent).toContain('Showing last successful data');
    expect(document.querySelector('#proposal-counter')?.textContent).toBe('1 live proposal');
    expect(localStorage.getItem('ton-config-voting:last-snapshot:v10')).toBe(saved);
    (document.querySelector('#refresh-button') as HTMLButtonElement).click();
    expect(fetcher).toHaveBeenCalledTimes(3);

    await jest.advanceTimersByTimeAsync(31_100);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(document.querySelector('#connection-status')?.textContent).toBe('');
    expect(document.querySelector('#proposal-counter')?.textContent).toBe('1 live proposal');
    expect(fetcher.mock.calls.every(([url]) => String(url).startsWith('https://toncenter.com/api/v2/'))).toBe(true);
});

it('shows a first-load network error and recovers even if the saved snapshot is corrupt', async () => {
    localStorage.setItem('ton-config-voting:last-snapshot:v10', JSON.stringify({ savedAt: Date.now(), snapshot: {} }));
    const fixture = votingResponses();
    window.fetch = jest.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(response(fixture.account)).mockResolvedValueOnce(response(fixture.empty));
    window.eval(bundle);
    await jest.advanceTimersByTimeAsync(0);
    expect(document.querySelector('#connection-status')?.textContent).toContain('internet connection');
    expect(document.querySelector('#connection-status')?.textContent).toContain('Retrying automatically');
    await jest.advanceTimersByTimeAsync(31_100);
    expect(document.querySelector('#proposal-counter')?.textContent).toBe('0 live proposals');
    expect(document.querySelector('#status')?.textContent).toContain('No active config proposals');
});

it('continues polling and preserves rendered data when local storage is unavailable', async () => {
    const fixture = votingResponses();
    const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    window.fetch = jest.fn().mockResolvedValueOnce(response(fixture.account))
        .mockResolvedValueOnce(response(fixture.proposals)).mockResolvedValue(response(null, 503));
    try {
        window.eval(bundle);
        await jest.advanceTimersByTimeAsync(1100);
        expect(document.querySelector('#proposal-counter')?.textContent).toBe('1 live proposal');
        await jest.advanceTimersByTimeAsync(28_900);
        expect(document.querySelector('#connection-status')?.textContent).toContain('503');
        expect(document.querySelector('#connection-status')?.textContent).toContain('Showing last successful data');
        expect(document.querySelector('#proposal-counter')?.textContent).toBe('1 live proposal');
    } finally {
        storage.mockRestore();
    }
});
