import simpleGit, {ResetMode, SimpleGit} from "simple-git";
import {appBancaDir, gitlabEmail, gitlabName} from "./constants";
import prompt from "prompt";
import {Utils} from "./utils";

simpleGit().env({
    GIT_AUTHOR_NAME: gitlabName,
    GIT_AUTHOR_EMAIL: gitlabEmail
});
const git: SimpleGit = simpleGit('./')
prompt.start();

const targetBranch = 'feature/285044_285053_285054';
const NMOLRFCToMergeInTarget: string[] = [
    '260697',
    '260700',
    '260703',
    '260706',
    '260709',
    '260713',
    '260699',
    '260698'
];
const modules: string[] = ['ib_flutter_lib_a11y_utils', 'ib_flutter_app_banca'];

async function run(): Promise<void> {
    await prompt.get({
        description: 'IMPORTANTE!!! Fai un discard di tutte le modifiche pendenti (o pushale) prima di continuare. Premi un tasto per continuare'
    });
    process.chdir(appBancaDir)
    const branchesToMergeMap = await retrieveMap(NMOLRFCToMergeInTarget);
    console.log('Branches to merge retrieved');
    console.log(branchesToMergeMap);
    await mergeToTarget(branchesToMergeMap);
    console.log('Merge to target finished');
}

async function mergeToTarget(branchesToMerge: Map<string, string[]>): Promise<void> {
    const logPrefix = '[mergeToTarget] - ';
    const remotes = await git.getRemotes();

    for (const key of branchesToMerge.keys()) {
        process.chdir('../' + key);
        const branches = branchesToMerge.get(key) ?? [];

        for (let branch of branches) {
            console.log(`${logPrefix} Merging ${branch} into ${targetBranch}`);
            let mergeOK = false;

            do {
                try {
                    await git.reset(ResetMode.HARD);

                    // update rfc branch
                    await git.checkout(branch);
                    await git.pull(remotes[0].name, branch);

                    // update target branch
                    await git.checkout(targetBranch);
                    await git.pull(remotes[0].name, targetBranch);

                    // merge rfc branch into target branch
                    const mergeResult = await git.mergeFromTo(branch, targetBranch);

                    if (mergeResult.failed) {
                        console.error(`${logPrefix} ${key} - merge failed`);
                        process.exit(1);
                    }

                    console.log(`${logPrefix} ${key} - merged ${branch} into ${targetBranch}. SUCCESS`);
                    // await git.push(remotes[0].name, targetBranch);
                    mergeOK = true;

                } catch (e) {
                    console.error(`${logPrefix} ${key} - merge ${branch} into ${targetBranch} ERROR: ${e}`);

                    await prompt.get({
                        description: 'Merge fallito. Risolvi i conflitti e premi invio per riprovare.'
                    });

                    await git.commit(getCommitMessage(branch));
                }
            } while (!mergeOK);
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

async function retrieveMap(rfcToUpdate: string[]): Promise<Map<string, string[]>> {
    const logPrefix = '[retrieveMap] -';
    let mapModuleBranch = new Map<string, string[]>

    for (let module of modules) {
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

void run();
