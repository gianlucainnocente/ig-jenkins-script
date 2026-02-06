import simpleGit, {ResetMode, SimpleGit} from "simple-git";
import {
    analyzeTestModules,
    appBancaMasterDir,
    gitlabEmail,
    gitlabName,
    operatingSystem,
    redmineToken,
    redmineUsername
} from "./constants";
import prompt from "prompt";
import {modules, productionModules} from "./branches";
import util from "node:util";
import {Utils} from "./utils";
import {Redmine, RedmineTS} from "redmine-ts";

const exec = util.promisify(require('child_process').exec);

simpleGit().env({
    GIT_AUTHOR_NAME: gitlabName,
    GIT_AUTHOR_EMAIL: gitlabEmail
});
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
const redmineConfig: RedmineTS.Config = {
    apiKey: redmineToken,
    username: redmineUsername,
};
const git: SimpleGit = simpleGit('./')
prompt.start();


async function run(): Promise<void> {
    const logPrefix = '[run] -';
    await prompt.get({
        description: 'IMPORTANTE!!! Fai un discard di tutte le modifiche pendenti (o pushale) prima di continuare. Premi un tasto per continuare'
    });

    process.chdir(appBancaMasterDir)
    console.time('run')
    let rfcToUpdate = await retrieveRfcRelease();


    let map = await retrieveMap(rfcToUpdate);


    console.log(map);
    for (const key of map.keys()) {
        console.log(`[branch] ${key}`);

        let modules = map.get(key) ?? [];
        for (let module of modules) {
            process.chdir('../' + module);
            const remotes = await git.getRemotes();


            await git.reset(ResetMode.HARD);
            await git.clean('f', ['-d']);
            await git.checkout(key);
            await git.pull(remotes[0].name, key);
        }

        console.log(`${logPrefix} All modules updated for rfc ${key}`);
        console.log('----------------------------------------');

        process.chdir('../ib_flutter_app_banca');
        console.log(`${logPrefix} Setting up local dependencies...`);
        if (operatingSystem === 'mac') {
            await exec('rps setup local')
        } else {
            await exec('cd .. && python ./ib_flutter_app_banca/tool/init.py localDep && python ./ib_flutter_app_banca/tool/init.py getAll && cd ./ib_flutter_app_banca')
        }

        console.log(`${logPrefix} Local dependencies set up completed.`);

        await doFlutterAnalyze(modules);

        await doFlutterTest(modules);

        await doCommitAndPush(key, modules);

        await updateMaster();

        console.log(`${logPrefix} RFC ${key} processing completed. Remaining RFCs count: ${Array.from(map.keys()).filter(k => k !== key).length}. Done RFCs count: ${Array.from(map.keys()).indexOf(key) + 1}`);
        console.log('========================================');

    }
    console.timeEnd('run')

}

async function runFlutterAnalyzeInModule(moduleName: string): Promise<void> {
    const logPrefix = `[flutterAnalyze - ${moduleName}]`;

    let done = false;
    while (!done) {
        console.log(`${logPrefix} Starting flutter analyze...`);

        try {
            await exec(
                'dart run build_runner build --delete-conflicting-outputs',
                {cwd: `../${moduleName}`}
            );

            const {stdout, stderr} = await exec('flutter analyze', {cwd: `../${moduleName}`});

            if (stdout) console.log(`${logPrefix} stdout:\n${stdout}`);
            if (stderr) console.log(`${logPrefix} stderr:\n${stderr}`);

            if (stdout.includes('error •') || stderr.includes('error •')) {
                console.log(`${logPrefix} ❌ Errors found`);
                await prompt.get({
                    description: `${logPrefix} Hai corretto gli errori? Premi INVIO per rieseguire l'analyze`
                });
            } else {
                console.log(`${logPrefix} ✅ Nessun errore`);
                done = true;
            }
        } catch (e: any) {
            console.log(`${logPrefix} Exec error: ${e}`);
            const match = String(e.message).match(/(\d+)\s+issues?/i);
            const errorCount = match ? Number(match[1]) : 0;
            const buildRunnerError = String(e.message).includes('build_runner');

            const moduleWithAllowedErrors = analyzeTestModules.find(m => m.name === moduleName);
            if (!buildRunnerError && moduleWithAllowedErrors && errorCount <= moduleWithAllowedErrors.allowedAnalyzeErrors) {
                console.log(`${logPrefix} [${moduleName}] ⚠️ Errori ammessi (${errorCount}/${moduleWithAllowedErrors.allowedAnalyzeErrors}) → skipped`);
                done = true;
                continue;
            }

            Utils.sendNotification(`Flutter analyze in ${moduleName} failed. Check the terminal.`);
            const q = await prompt.get({
                description: `${logPrefix} Hai corretto i problemi? \n1- Riprova\n2- Salta analyze per questo modulo`
            });
            if (q.question == '2') {
                done = true;
            }
        }
    }

    console.log(`${logPrefix} Finished`);
}

async function doFlutterAnalyze(modules: string[]): Promise<void> {
    console.log('[flutterAnalyze] - modulesWithCurrentRFC = ', modules);
    //await Promise.all(modulesWithCurrentRFC.map(m => runFlutterAnalyzeInModule(m.name)));
    for (const module of modules) {
        await runFlutterAnalyzeInModule(module);
    }
    console.log('[flutterAnalyze] - All modules analyzed in parallel ✅');
}

async function runFlutterTestInModule(moduleName: string): Promise<void> {
    const logPrefix = `[flutterTest - ${moduleName}]`;

    let done = false;
    while (!done) {
        console.log(`${logPrefix} Starting test...`);

        try {
            const {stdout, stderr} = await exec('flutter test', {cwd: `../${moduleName}`});

            if (stdout) console.log(`${logPrefix} stdout:\n${stdout}`);
            if (stderr) console.log(`${logPrefix} stderr:\n${stderr}`);

            if (stdout.includes('Some tests failed') || stderr.includes('Some tests failed')) {
                console.log(`${logPrefix} ❌ Test failed`);
                await prompt.get({
                    description: `${logPrefix} Correggi i test e premi INVIO per riprovare`
                });
            } else {
                console.log(`${logPrefix} ✅ All tests passed`);
                done = true;
            }
        } catch (e: any) {
            console.log(`${logPrefix} Exec error: ${e}`);
            Utils.sendNotification(`Flutter test in ${moduleName} failed. Check the terminal.`);
            await prompt.get({
                description: `${logPrefix} Hai corretto i problemi? Premi INVIO per riprovare`
            });
        }
    }
}

async function doFlutterTest(modules: string[]): Promise<void> {
    //await Promise.all(modulesWithCurrentRFC.map(m => runFlutterTestInModule(m.name)));
    for (const module of modules) {
        await runFlutterTestInModule(module);
    }
    console.log('[flutterTest] - All modules tested in parallel ✅');
}

async function doCommitAndPush(rfc: string, modules: string[]): Promise<void> {
    const logPrefix = '[commitAndPush] -';

    for (const module of modules) {
        process.chdir('../' + module);

        const remotes = await git.getRemotes();
        const branches = await git.branch();
        const targetBranchRaw = Object.keys(branches.branches).find(branchName => Utils.isValidRFCBranch(branchName, rfc));
        if (!targetBranchRaw) {
            console.log(`${logPrefix} No valid branch found for rfc ${rfc} in module ${module}, skipping...`);
            continue;
        }

        const targetBranch = Utils.normalizeBranchName(targetBranchRaw);

        await git.checkout(['pubspec.yaml'])
        try {
            await git.checkout(['pubspec.lock'])
        } catch (e) {
            console.log(`${logPrefix} pubspec.lock not found, skipping...`);
        }
        const status = await git.status();
        if (status.files.length === 0) {
            console.log(`${logPrefix} No changes to commit in ${module}, skipping...`);
            continue;
        }

        console.log(`${logPrefix} Changes detected in ${module}. Committing and pushing...`);
        await git.add('.');
        await git.commit(Utils.getCommitMessage(targetBranch, 'analyze and test fixes'));
        await git.push(remotes[0].name, targetBranch);
    }
}

async function updateMaster(): Promise<void> {
    const logPrefix = '[updateMaster] -';
    let currentModule = '';
    try {
        for (const module of productionModules) {
            currentModule = module;
            process.chdir('../' + module);

            let branchToUpdate = 'master';

            if (currentModule === 'ib_flutter_app_banca') {
                branchToUpdate = 'preproduzione_produzione';
            }

            console.log(`${logPrefix} module ${module}`);

            await git.reset(ResetMode.HARD);
            await git.clean('f', ['-d']);
            await git.fetch();
            await git.checkout(branchToUpdate);
        }
    } catch (e) {
        console.log(`${logPrefix} Error for ${currentModule}: ${e}`);
        process.exit();
    }
}

async function retrieveMap(rfcToUpdate: string[]) {
    const logPrefix = '[retrieveMap] -';
    let mapModuleBranch = new Map<string, string[]>

    for (const rfc of rfcToUpdate) {
        for (const module of productionModules) {
            process.chdir('../' + module);
            const branches = await git.branch();
            const targetBranchRaw = Object.keys(branches.branches).find(branchName => Utils.isValidRFCBranch(branchName, rfc));
            if (!targetBranchRaw) {
                continue;
            }
            const targetBranch = Utils.normalizeBranchName(targetBranchRaw);

            console.log(`${logPrefix}  Branch found ${targetBranch} in module ${module}`);
            let existingValues: string[] | undefined = mapModuleBranch.get(targetBranch);
            if (!existingValues) {
                mapModuleBranch.set(targetBranch, []);
            }
            if (!existingValues?.includes(module)) {
                existingValues ??= [];
                existingValues?.push(module);
            }
            mapModuleBranch.set(targetBranch, existingValues ?? []);
        }
    }
    return mapModuleBranch;
}

async function retrieveRfcRelease() {
    const redmine = new Redmine('https://redmine.gbm.lan', redmineConfig);

    let rfcWeb = [];
    let rfcMobile = [];

    let rfcWebCanali = [];
    let rfcMobileCanali = [];

    let releaseWebId = await prompt.get({
        description: 'Inserisci id della release NMOL'
    });
    console.log(`Release NMOL Id: ${releaseWebId.question}`);

    let releaseMobileId = await prompt.get({
        description: 'Inserisci id della release Mobile'
    });
    console.log(`Release Mobile Id: ${releaseMobileId.question}`);
    let issuesWeb = await redmine.listIssues({
        assigned_to_id: 1959,
        // @ts-ignore
        "fixed_version_id": releaseWebId.question,
        limit: 1000,
    })
    if (releaseMobileId.question != '') {
        let issuesMobile = await redmine.listIssues({
            assigned_to_id: 1959,
            // @ts-ignore
            "fixed_version_id": releaseMobileId.question,
            limit: 1000,
        })
        rfcMobile = issuesMobile.issues.map((e: { id: any; }) => e.id).sort((a: number, b: number) => a - b);

        let issuesMobileCanali = await redmine.listIssues({
            assigned_to_id: 3489,
            // @ts-ignore
            "fixed_version_id": releaseMobileId.question,
            limit: 1000,
        })
        rfcMobileCanali = issuesMobileCanali.issues.map((e: {
            id: any;
        }) => e.id).sort((a: number, b: number) => a - b);
    }

    let issuesWebCanali = await redmine.listIssues({
        assigned_to_id: 3489,
        // @ts-ignore
        "fixed_version_id": releaseWebId.question,
        limit: 1000,
    })

    rfcWeb = issuesWeb.issues.map((e: { id: any; }) => e.id).sort((a: number, b: number) => a - b);
    rfcWebCanali = issuesWebCanali.issues.map((e: { id: any; }) => e.id).sort((a: number, b: number) => a - b);
    console.log(rfcWeb);
    console.log(rfcMobile);
    console.log(rfcWebCanali);
    console.log(rfcMobileCanali);

    return [...rfcWeb, ...rfcMobile, ...rfcWebCanali, ...rfcMobileCanali];
}

void run();
