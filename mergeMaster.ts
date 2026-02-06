import simpleGit, {ResetMode, SimpleGit} from "simple-git";
import {appBancaMasterDir, gitlabEmail, gitlabName, redmineToken, redmineUsername} from "./constants";
import prompt from "prompt";
import {productionModules, modules} from "./branches";
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
    console.time('run')
    await updateMaster();
    console.log('Update master finished');
    await mergeMaster();
    console.timeEnd('run')

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

            await git.fetch();
            if (currentModule !== 'ib_flutter_feature_polizze') {
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


    let map = await retrieveMap(rfcToUpdate);
    console.log('Branches to merge retrieved', map);
    let branchFrom = 'master';
    const remotes = await git.getRemotes();
    for (const key of map.keys()) {
        console.log(`[module] ${key}`);
        process.chdir('../' + key);
        if (key === 'ib_flutter_app_banca') {
            branchFrom = 'preproduzione_produzione';
        }
        let branches = map.get(key) ?? [];
        for (let branch of branches) {
            console.log(`${logPrefix} Merging ${branchFrom} into ${branch}`);
            if (branch === 'feature/280462_280463_280464') continue
            let mergeOK: boolean = false;
            do {
                try {
                    console.log(`[branch] ${key} ${remotes[0].name} ${branch}`);
                    await git.reset(ResetMode.HARD);
                    await git.checkout(branch);
                    await git.pull(remotes[0].name, branch);


                    let mergeResult = await git.mergeFromTo(branchFrom, branch);
                    if (mergeResult.failed) {
                        console.log(`${logPrefix} ${key} - merge failed. Exiting`);
                        process.exit();
                    }
                    console.log(`${logPrefix} ${key} - merge master into ${branch}. SUCCESS`);
                    await git.push();
                    mergeOK = true;
                } catch (e) {
                    console.log(`${logPrefix} ${module} - merge master into ${branch}. Error: ${e}`);

                    Utils.sendNotification(`Merge fallito in ${key} - ${branch}. Risolvi i conflitti e continua.`);
                    await prompt.get({
                        description: 'Merge fallito. Risolvi i conflitti e premi un tasto per riprovare.'
                    });

                    await git.commit(getCommitMessage(branch));
                }
            } while (!mergeOK);

        }

    }

}

async function retrieveMap(rfcToUpdate: string[]) {
    const logPrefix = '[retrieveMap] -';
    let mapModuleBranch = new Map<string, string[]>

    for (let module of productionModules) {
        process.chdir('../' + module);
        mapModuleBranch.set(module, []);
        const branches = await git.branch();
        for (const rfc of rfcToUpdate) {
            const targetBranchRaw = Object.keys(branches.branches).find(branchName => Utils.isValidRFCBranch(branchName, rfc));
            if (!targetBranchRaw) {
                console.log(`${logPrefix} No valid branch found for rfc ${rfc} in module ${module}, skipping...`);
                continue;
            }
            const targetBranch = Utils.normalizeBranchName(targetBranchRaw);

            // @ts-ignore
            let existingValues: string[] = mapModuleBranch.get(module);
            if (!existingValues?.includes(targetBranch)) {
                existingValues?.push(targetBranch);
            }
            mapModuleBranch.set(module, existingValues);
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

function getCommitMessage(branch: string): string {
    let rfc = branch.split('/')[1];
    if (!/\d/.test(rfc)) {
        rfc = '999999';
    }
    return `refs #${rfc} - conflict fix`;
}

void run();
