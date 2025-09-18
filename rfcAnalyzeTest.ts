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

            await git.fetch();
            await git.checkout(branchToUpdate);
            await git.pull(module.name);
        }
    } catch (e) {
        console.log(`${logPrefix} Error for ${currentModule}: ${e}`);
        process.exit();
    }
}

async function run(): Promise<void> {
    const logPrefix = '[run] -';
    await prompt.get({
        description: 'IMPORTANTE!!! Fai un discard di tutte le modifiche pendenti (o pushale) prima di continuare. Premi un tasto per continuare'
    });

    process.chdir(appBancaMasterDir)

    for (const rfc of rfcToUpdate) {
        await updateMaster();

        for (const module of modules) {
            process.chdir('../' + module.name);

            const remotes = await git.getRemotes();
            const branches = await git.branch();
            const targetBranchRaw = Object.keys(branches.branches).find(branchName => Utils.isValidRFCBranch(branchName, rfc));
            if (!targetBranchRaw) {
                console.log(`${logPrefix} No valid branch found for rfc ${rfc} in module ${module.name}, skipping...`);
                continue;
            }

            const targetBranch = Utils.normalizeBranchName(targetBranchRaw);

            await git.reset(ResetMode.HARD);
            await git.checkout(targetBranch);
            await git.pull(remotes[0].name, targetBranch);
        }

        console.log(`${logPrefix} All modules updated for rfc ${rfc}`);
        console.log('----------------------------------------');

        process.chdir('../ib_flutter_app_banca');
        if (operatingSystem === 'mac') {
            await exec('rps setup local')
        } else {
            await exec('cd .. && python ./ib_flutter_app_banca/tool/init.py localDep && python ./ib_flutter_app_banca/tool/init.py getAll && cd ./ib_flutter_app_banca')
        }

        const responseAnalyze = await prompt.get({
            description: `${logPrefix} Puntamenti locali impostati per l'RFC ${rfc}. Vuoi eseguire l'analyze?\n1 - Si\n2 - No`,
        });
        if (responseAnalyze.question.toString() == '1') {
            await doFlutterAnalyze();
        }

        const responseTest = await prompt.get({
            description: `${logPrefix} Vuoi eseguire i test?\n1 - Si\n2 - No`,
        });

        if (responseTest.question.toString() == '1') {
            await doFlutterTest();
        }

        console.log(`${logPrefix} RFC ${rfc} processing completed.`);
        console.log('========================================');
    }
}

async function doFlutterAnalyze(): Promise<void> {
    const logPrefix = '[flutterAnalyze] -';

    for (const module of modules) {
        process.chdir('../' + module.name);

        let done = false;
        while (!done) {
            console.log(`${logPrefix} Starting flutter analyze in module ${module.name}...`);

            try {
                await exec('flutter pub run build_runner build --delete-conflicting-outputs');
                const {stdout, stderr} = await exec('flutter analyze');

                if (stdout) {
                    console.log(`${logPrefix} stdout:\n${stdout}`);
                }
                if (stderr) {
                    console.log(`${logPrefix} stderr:\n${stderr}`);
                }

                if (stdout.includes('error •') || stderr.includes('error •')) {
                    console.log(`${logPrefix} ERROR found in ${module.name}`);

                    await prompt.get({
                        description: `${logPrefix} Hai corretto gli errori in ${module.name}? Premi INVIO per rieseguire l'analyze`
                    });

                } else {
                    console.log(`${logPrefix} ✅ Nessun errore in ${module.name}`);
                    done = true;
                }
            } catch (e: any) {
                console.log(`${logPrefix} Exec error: ${e}`);
                await prompt.get({
                    description: `${logPrefix} Hai corretto i problemi in ${module.name}? Premi INVIO per riprovare`
                });
            }
        }

        console.log(`${logPrefix} Flutter analyze finished for ${module.name}`);
    }

    console.log(`${logPrefix} Flutter analyze finished for all modules`)
}

async function doFlutterTest(): Promise<void> {
    const logPrefix = '[flutterTest] -';

    for (const module of modules) {
        process.chdir('../' + module.name);

        let done = false;
        while (!done) {
            console.log(`${logPrefix} Starting flutter test in module ${module.name}...`);

            try {
                const { stdout, stderr } = await exec('flutter test');

                if (stdout) {
                    console.log(`${logPrefix} stdout:\n${stdout}`);
                }
                if (stderr) {
                    console.log(`${logPrefix} stderr:\n${stderr}`);
                }

                if (stdout.includes('Some tests failed') || stderr.includes('Some tests failed')) {
                    console.log(`${logPrefix} ❌ Test failed in ${module.name}`);
                    await prompt.get({
                        description: `${logPrefix} Correggi i test in ${module.name} e premi INVIO per riprovare`
                    });
                } else {
                    console.log(`${logPrefix} ✅ All tests passed in ${module.name}`);
                    done = true;
                }
            } catch (e: any) {
                console.log(`${logPrefix} Exec error: ${e}`);
                await prompt.get({
                    description: `${logPrefix} Hai corretto i problemi in ${module.name}? Premi INVIO per riprovare`
                });
            }
        }
    }

    console.log(`${logPrefix} Flutter test finished for all modules`)
}

void run();
