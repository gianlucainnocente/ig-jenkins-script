import simpleGit, {ResetMode, SimpleGit} from "simple-git";
import {appBancaMasterDir, gitlabEmail, gitlabName, operatingSystem} from "./constants";
import prompt from "prompt";
import {modules, rfcToUpdate} from "./branches";
import util from "node:util";
import {Utils} from "./utils";

const exec = util.promisify(require('child_process').exec);

simpleGit().env({
    GIT_AUTHOR_NAME: gitlabName,
    GIT_AUTHOR_EMAIL: gitlabEmail
});

const git: SimpleGit = simpleGit('./')
prompt.start();

let modulesWithCurrentRFC: any[] = [];

async function run(): Promise<void> {
    const logPrefix = '[run] -';
    await prompt.get({
        description: 'IMPORTANTE!!! Fai un discard di tutte le modifiche pendenti (o pushale) prima di continuare. Premi un tasto per continuare'
    });

    process.chdir(appBancaMasterDir)

    const processedRFCs: string[] = [];
    for (const rfc of rfcToUpdate) {
        modulesWithCurrentRFC = [];
        await updateMaster();
        if (processedRFCs.includes(rfc)) {
            console.log(`${logPrefix} RFC ${rfc} already processed, skipping...`);
            continue;
        }

        for (const module of modules) {
            process.chdir('../' + module.name);

            const remotes = await git.getRemotes();
            const branches = await git.branch();
            const targetBranchRaw = Object.keys(branches.branches).find(branchName => Utils.isValidRFCBranch(branchName, rfc));
            if (!targetBranchRaw) {
                console.log(`${logPrefix} No valid branch found for rfc ${rfc} in module ${module.name}, skipping...`);
                continue;
            }

            modulesWithCurrentRFC.push(module);

            const targetBranch = Utils.normalizeBranchName(targetBranchRaw);

            await git.reset(ResetMode.HARD);
            await git.checkout(targetBranch);
            await git.pull(remotes[0].name, targetBranch);
        }

        console.log(`${logPrefix} All modules updated for rfc ${rfc}`);
        console.log('----------------------------------------');

        process.chdir('../ib_flutter_app_banca');
        console.log(`${logPrefix} Setting up local dependencies...`);
        if (operatingSystem === 'mac') {
            await exec('rps setup local')
        } else {
            await exec('cd .. && python ./ib_flutter_app_banca/tool/init.py localDep && python ./ib_flutter_app_banca/tool/init.py getAll && cd ./ib_flutter_app_banca')
        }

        console.log(`${logPrefix} Local dependencies set up completed.`);

        const responseAnalyze = await prompt.get({
            description: `${logPrefix} Puntamenti locali impostati per l'RFC ${rfc}. Vuoi eseguire l'analyze?\n1 - Si\n2 - No`,
        });
        if (responseAnalyze.question == '1') {
            await doFlutterAnalyze();
        }

        const responseTest = await prompt.get({
            description: `${logPrefix} Vuoi eseguire i test?\n1 - Si\n2 - No`,
        });

        if (responseTest.question == '1') {
            await doFlutterTest();
        }

        await doCommitAndPush(rfc);

        processedRFCs.push(rfc);
        console.log(`${logPrefix} RFC ${rfc} processing completed.`);
        console.log('========================================');
    }
}

async function runFlutterAnalyzeInModule(moduleName: string): Promise<void> {
    const logPrefix = `[flutterAnalyze - ${moduleName}]`;

    let done = false;
    while (!done) {
        console.log(`${logPrefix} Starting flutter analyze...`);

        try {
            await exec(
                'flutter pub run build_runner build --delete-conflicting-outputs',
                { cwd: `../${moduleName}` }
            );

            const { stdout, stderr } = await exec('flutter analyze', { cwd: `../${moduleName}` });

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

async function doFlutterAnalyze(): Promise<void> {
    console.log('[flutterAnalyze] - modulesWithCurrentRFC = ', modulesWithCurrentRFC.map(m => m.name));
    //await Promise.all(modulesWithCurrentRFC.map(m => runFlutterAnalyzeInModule(m.name)));
    for (const module of modulesWithCurrentRFC) {
        await runFlutterAnalyzeInModule(module.name);
    }
    console.log('[flutterAnalyze] - All modules analyzed in parallel ✅');
}

async function runFlutterTestInModule(moduleName: string): Promise<void> {
    const logPrefix = `[flutterTest - ${moduleName}]`;

    let done = false;
    while (!done) {
        console.log(`${logPrefix} Starting flutter test...`);

        try {
            const { stdout, stderr } = await exec('flutter test', { cwd: `../${moduleName}` });

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
            await prompt.get({
                description: `${logPrefix} Hai corretto i problemi? Premi INVIO per riprovare`
            });
        }
    }
}

async function doFlutterTest(): Promise<void> {
    //await Promise.all(modulesWithCurrentRFC.map(m => runFlutterTestInModule(m.name)));
    for (const module of modulesWithCurrentRFC) {
        await runFlutterTestInModule(module.name);
    }
    console.log('[flutterTest] - All modules tested in parallel ✅');
}

async function doCommitAndPush(rfc: string): Promise<void> {
    const logPrefix = '[commitAndPush] -';

    for (const module of modulesWithCurrentRFC) {
        process.chdir('../' + module.name);

        const remotes = await git.getRemotes();
        const branches = await git.branch();
        const targetBranchRaw = Object.keys(branches.branches).find(branchName => Utils.isValidRFCBranch(branchName, rfc));
        if (!targetBranchRaw) {
            console.log(`${logPrefix} No valid branch found for rfc ${rfc} in module ${module.name}, skipping...`);
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
            console.log(`${logPrefix} No changes to commit in ${module.name}, skipping...`);
            continue;
        }

        console.log(`${logPrefix} Changes detected in ${module.name}. Committing and pushing...`);
        await git.add('.');
        await git.commit(Utils.getCommitMessage(targetBranch, 'analyze and test fixes'));
        await git.push(remotes[0].name, targetBranch);
    }
}

async function updateMaster(): Promise<void> {
    const logPrefix = '[updateMaster] -';
    let currentModule = '';
    try {
        for (const module of modules) {
            currentModule = module.name;
            process.chdir('../' + module.name);

            let branchToUpdate = 'master';

            if (currentModule === 'ib_flutter_app_banca') {
                branchToUpdate = 'preproduzione_produzione';
            }

            console.log(`${logPrefix} module ${module.name}`);

            await git.reset(ResetMode.HARD);
            await git.fetch();
            await git.checkout(branchToUpdate);
            await git.pull(module.name);
        }
    } catch (e) {
        console.log(`${logPrefix} Error for ${currentModule}: ${e}`);
        process.exit();
    }
}

void run();
