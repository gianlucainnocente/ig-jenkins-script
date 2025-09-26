import simpleGit, {ResetMode, SimpleGit} from "simple-git";
import {appBancaMasterDir, gitlabEmail, gitlabName, redmineToken, redmineUsername} from "./constants";
import prompt from "prompt";
import {deloitteModules, modules} from "./branches";
import {Utils} from "./utils";
import {Redmine, RedmineTS} from "redmine-ts";

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
        for (const module of deloitteModules) {
            currentModule = module;
            process.chdir('../' + module);

            let branchToUpdate = 'master';

            if (currentModule === 'ib_flutter_app_banca') {
                branchToUpdate = 'preproduzione_produzione';
            }

            console.log(`${logPrefix} module ${module}`);

            await git.fetch();
            if(currentModule !== 'ib_flutter_feature_polizze') {
                await git.checkout(branchToUpdate);
                await git.pull(module);
            }

        }
    } catch (e) {
        console.log(`${logPrefix} Error for ${currentModule}: ${e}`);
        process.exit();
    }
}

async function mergeMaster(): Promise<void> {
    const logPrefix = '[mergeMaster] - ';
    let rfcToUpdate = await retrieveRfcRelease();

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


async function retrieveRfcRelease() {
    const redmine = new Redmine('https://redmine.gbm.lan', redmineConfig);

    let rfcWeb = [];
    let rfcMobile = [];

    let releaseWebId = await prompt.get({
        description: 'Inserisci id della release NMOL'
    });
    console.log(`Release NMOL Id: ${releaseWebId.question}`);

    let releaseMobileId = await prompt.get({
        description: 'Inserisci id della release NMOL'
    });
    console.log(`Release Mobile Id: ${releaseMobileId.question}`);
    let issuesWeb = await redmine.listIssues({
        assigned_to_id: 1959,
        // @ts-ignore
        "fixed_version_id": releaseWebId.question,
        limit: 1000,
    })
    let issuesMobile = await redmine.listIssues({
        assigned_to_id: 1959,
        // @ts-ignore
        "fixed_version_id": releaseMobileId.question,
        limit: 1000,
    })
    rfcWeb = issuesWeb.issues.map((e: { id: any; }) => e.id).sort((a: number, b: number) => a - b);
    rfcMobile = issuesMobile.issues.map((e: { id: any; }) => e.id).sort((a: number, b: number) => a - b);
    console.log(rfcWeb);
    console.log(rfcMobile);

    return [...rfcWeb, ...rfcMobile];
}

function getCommitMessage(branch: string): string {
    let rfc = branch.split('/')[1];
    if (!/\d/.test(rfc)) {
        rfc = '999999';
    }
    return `refs #${rfc} - conflict fix`;
}

void run();
