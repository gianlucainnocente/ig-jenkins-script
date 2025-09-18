import simpleGit, {ResetMode, SimpleGit} from "simple-git";
import {appBancaMasterDir, gitlabEmail, gitlabName} from "./constants";
import prompt from "prompt";
import {modules, rfcToUpdate} from "./branches";
import {Utils} from "./utils";

simpleGit().env({
    GIT_AUTHOR_NAME: gitlabName,
    GIT_AUTHOR_EMAIL: gitlabEmail
});

const git: SimpleGit = simpleGit('./')
prompt.start();

async function run(): Promise<void> {
    await prompt.get({
        description: 'IMPORTANTE!!! Fai un discard di tutte le modifiche pendenti (o pushale) prima di continuare. Premi un tasto per continuare'
    });

    process.chdir(appBancaMasterDir)

    await updateMaster();
    console.log('Update master finished');

    await mergeMaster();
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

            await git.fetch();
            await git.checkout(branchToUpdate);
            await git.pull(module.name);
        }
    } catch (e) {
        console.log(`${logPrefix} Error for ${currentModule}: ${e}`);
        process.exit();
    }
}

async function mergeMaster(): Promise<void> {
    const logPrefix = '[mergeMaster] - ';
    for (const rfc of rfcToUpdate) {
        let currentModule = '';
        for (const module of modules) {
            currentModule = module.name;
            process.chdir('../' + module.name);
            console.log(`${logPrefix} module ${module.name} and rfc ${rfc}`);

            let branchFrom = 'master';
            if (currentModule === 'ib_flutter_app_banca') {
                branchFrom = 'preproduzione_produzione';
            }

            const remotes = await git.getRemotes();
            const branches = await git.branch();
            const targetBranchRaw = Object.keys(branches.branches).find(branchName => Utils.isValidRFCBranch(branchName, rfc));
            if (!targetBranchRaw) {
                console.log(`${logPrefix} No valid branch found for rfc ${rfc} in module ${module.name}, skipping...`);
                continue;
            }

            const targetBranch = Utils.normalizeBranchName(targetBranchRaw);

            console.log(`${logPrefix} Checking out branch ${targetBranch}`);
            await git.reset(ResetMode.HARD);
            await git.checkout(targetBranch);
            await git.pull(remotes[0].name, targetBranch);

            console.log(`${logPrefix} Merging ${branchFrom} into ${targetBranch}`);

            let mergeOK: boolean = false;
            do {
                try {
                    let mergeResult = await git.mergeFromTo(branchFrom, targetBranch);
                    if (mergeResult.failed) {
                        console.log(`${logPrefix} ${module.name} - merge failed. Exiting`);
                        process.exit();
                    }

                    console.log(`${logPrefix} ${module.name} - merge master into ${targetBranch}. SUCCESS`);
                    mergeOK = true;
                } catch (e) {
                    console.log(`${logPrefix} ${module.name} - merge master into ${targetBranch}. Error: ${e}`);

                    await prompt.get({
                        description: 'Merge fallito. Risolvi i conflitti e premi un tasto per riprovare.'
                    });

                    await git.commit(getCommitMessage(targetBranch));
                }
            } while (!mergeOK);

            await git.push();
        }
    }
}

function getCommitMessage(branch: string): string {
    let rfc = branch.split('/')[1];
    if (!/\d/.test(rfc)) {
        rfc = '999999';
    }
    return `refs #${rfc} - conflict fix`;
}

void run();
