import {redmineToken, redmineUsername} from "./constants";
import prompt from "prompt";
import {Redmine, RedmineTS} from "redmine-ts";
import {exec} from "child_process";

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

const redmineConfig: RedmineTS.Config = {
    apiKey: redmineToken,
    username: redmineUsername,
};

import * as readline from 'readline';

interface ReleaseNoteResult {
    rfc: number;
    installed: boolean;
    noteCount?: string;
    details?: string;
}

async function run(): Promise<void> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const ask = (q: string) => new Promise<string>(resolve => rl.question(q, resolve));

    const releaseWebId = await ask('Inserisci id della release NMOL: ');
    
    console.log('\nNaviga su http://deploy.gbm.lan:8080/admin/release_notes e apri la tab network');
    console.log('\nPremi il tasto "Filtra" sulla destra e copia la CURL della chiamata che inizia con release_notes');
    console.log('\nIncolla la CURL completo qui sotto (puoi incollare più righe).');
    console.log('Lo script rileverà automaticamente i cookie e proseguirà.\n');

    let curlBuffer = '';
    let cookie = '';

    // Switch to line-by-line mode to handle paste
    // We override the 'line' listener to accumulate input
    const lineListener = (line: string) => {
        curlBuffer += line + ' '; // replace newline with space implies flattening, which is fine for flags
        
        const cookieMatch = curlBuffer.match(/-b\s+['"]([^'"]+)['"]/);
        if (cookieMatch) {
            cookie = cookieMatch[1];
            // Found the cookie! 
            // We give a small delay to allow consuming remaining lines of a paste to prevent them from executing in shell
            setTimeout(() => {
                rl.close(); 
                processCurl(releaseWebId, cookie);
            }, 500);
            
            // Remove listener to stop processing but keep interface open for the timeout duration
            rl.removeListener('line', lineListener);
        }
    };

    rl.on('line', lineListener);
}


async function processCurl(releaseWebId: string, cookie: string) {
    console.log(`\n✅ Cookie extracted successfully.`);
    console.log(`Release NMOL Id: ${releaseWebId}`);
    
    const rfcList = await retrieveRfcRelease(releaseWebId);
    
    console.log(`Found ${rfcList.length} RFCs.`);

    const results: ReleaseNoteResult[] = [];

    // Loading animation
    let i = 0;
    const frames = ['.', '..', '...', '....'];
    const loadingInterval = setInterval(() => {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(`Loading${frames[i]}`);
        i = (i + 1) % frames.length;
    }, 250);

    for (const rfc of rfcList) {
        const result = await callReleaseNotes(rfc, cookie);
        results.push(result);
    }

    clearInterval(loadingInterval);
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    console.log('Loading complete!');

    // FINAL RECAP
    console.log('\n-----------------------------------------------------------');
    console.log('📝 FINAL RECAP REQUEST RELEASE NOTES');
    console.log('-----------------------------------------------------------');
    
    const installed = results.filter(r => r.installed);
    const notInstalled = results.filter(r => !r.installed);

    console.log(`\n✅  INSTALLED / OK (${installed.length}):`);
    if (installed.length > 0) {
        installed.forEach(r => console.log(`   - RFC #${r.rfc} (RN count: ${r.noteCount})`));
    } else {
        console.log('   (None)');
    }

    console.log(`\n❌  NOT INSTALLED / MISSING (${notInstalled.length}):`);
    if (notInstalled.length > 0) {
        notInstalled.forEach(r => console.log(`   - RFC #${r.rfc} -> ${r.details}`));
    } else {
        console.log('   (None)');
    }
    console.log('-----------------------------------------------------------\n');
}


async function retrieveRfcRelease(releaseWebId: string): Promise<number[]> {
    const redmine = new Redmine('https://redmine.gbm.lan', redmineConfig);

    const commonParams = {
        // @ts-ignore
        "fixed_version_id": releaseWebId,
        limit: 1000
    };

    let issuesWeb = await redmine.listIssues({
        assigned_to_id: 1959,
        ...commonParams
    });

    let issuesWebCanali = await redmine.listIssues({
        assigned_to_id: 3489,
        ...commonParams
    });

    // Filtra quelli che contengono "NMOL" nel subject (case insensitive per sicurezza)
    const nmolFilter = (issue: any) => issue.subject && issue.subject.toUpperCase().includes('NMOL');

    const rfcWeb = issuesWeb.issues
        .filter(nmolFilter)
        .map((e: { id: any; }) => e.id)
        .sort((a: number, b: number) => a - b);
        
    const rfcWebCanali = issuesWebCanali.issues
        .filter(nmolFilter)
        .map((e: { id: any; }) => e.id)
        .sort((a: number, b: number) => a - b);

    console.log(`RFC Web (NMOL filtered): ${rfcWeb.length} found`);
    console.log(`RFC Web Canali (NMOL filtered): ${rfcWebCanali.length} found`);

    const allRfcs = [...new Set([...rfcWeb, ...rfcWebCanali])]; // deduplicate just in case
    return allRfcs.sort((a, b) => a - b);
}

async function callReleaseNotes(rfc: number, cookie: string): Promise<ReleaseNoteResult> {
    const url = `http://deploy.gbm.lan:8080/admin/release_notes?q%5Brfcs_name_in%5D=%23${rfc}%2C&commit=Filtra&locale=it&order=id_desc`;
    // Removed verbose logging: console.log(`Processing RFC #${rfc}...`);
    
    // Use -s to silent progress meter, but capture output
    const command = `curl -s '${url}' \\
  -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \\
  -H 'Accept-Language: it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' \\
  -H 'Connection: keep-alive' \\
  -b '${cookie}' \\
  -H 'Referer: http://deploy.gbm.lan:8080/admin/release_notes?q%5Brfcs_name_in%5D=%2311111111&commit=Filtra&locale=it&order=id_desc' \\
  -H 'Upgrade-Insecure-Requests: 1' \\
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36' \\
  --insecure`;

    return new Promise((resolve) => {
        // Increase buffer just in case response is large
        exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                // Keep error logging or remove if strictly silent? 
                // Keeping error logging is generally safer for debugging, but user asked for just final recap.
                // Assuming silent unless critical failure, but let's keep errors in result details.
                resolve({ rfc, installed: false, details: `Execution error: ${error.message}` });
                return;
            }

            const paginationRegex = /<div class="pagination_information">Sto mostrando <b>(\d+)<\/b> Release Notes?.*<\/div>/;
            const paginationMatch = stdout.match(paginationRegex);
            const hasSystemTest = stdout.includes('systemtest');

            if (paginationMatch && hasSystemTest) {
                const count = paginationMatch[1];
                resolve({ rfc, installed: true, noteCount: count });
            } else {
                let reasons = [];
                if (!paginationMatch) reasons.push("Missing RN");
                if (!hasSystemTest) reasons.push("Missing RN in systemtest env");
                
                resolve({ rfc, installed: false, details: reasons.join(', ') });
            }
        });
    });
}

void run();
