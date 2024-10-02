/*
ISTRUZIONI PER L'USO

1. Lanciare il comando npx ts-node deploy.ts da terminale
2. Seguire le istruzioni a video
 */

import Jenkins from "jenkins";
import simpleGit, {ResetMode, SimpleGit} from "simple-git";
import prompt from "prompt";
import fs from "fs";
import * as util from "node:util";
import {
    appBancaDir,
    gitlabEmail,
    gitlabName, gitlabToken,
    jenkinsToken,
    jenkinsUsername,
    operatingSystem,
} from "./constants";
import {deloitteModules, modules} from "./branches";

const exec = util.promisify(require('child_process').exec);


let appBancaVersion = '';
let runningJobs: any[] = [];
let jenkinsBuildNumbers: any = {};

let runnngJobsPath = __dirname + '/runningJobs.json';
let commitsPath = __dirname + '/commits.json';
let mergeRequestsPath = __dirname + '/mergeRequests.json';

simpleGit().env({
    GIT_AUTHOR_NAME: gitlabName,
    GIT_AUTHOR_EMAIL: gitlabEmail
});
const git: SimpleGit = simpleGit('./')
const jenkins = new Jenkins({
    baseUrl: `http://${jenkinsUsername}:${jenkinsToken}@ci.devops.gbm.lan:8080`,
});

prompt.start();

async function deploy() {
    console.log('script in __dirname:', __dirname);

    await prompt.get({
        description: 'IMPORTANTE!! Fai un discard di tutte le modifiche pendenti (o pushale) prima di continuare. Premi un tasto per continuare'
    });

    process.chdir(appBancaDir)
    console.log(`Current directory: ${process.cwd()}`);

    let mode = 'full';
    let commits;
    let mergeRequests;
    let executeTests = false;
    let executeGenerate = false;
    let fixFormatEachBranch = false;

    try {
        let jsonRunningJobs = fs.readFileSync(runnngJobsPath);
        let jsonCommits = fs.readFileSync(commitsPath);
        let jsonMergeRequests = fs.readFileSync(mergeRequestsPath);
        if (jsonRunningJobs /*&& jsonCommits && jsonMergeRequests*/) {
            runningJobs = JSON.parse(jsonRunningJobs.toString());
            commits = JSON.parse(jsonCommits.toString());
            mergeRequests = JSON.parse(jsonMergeRequests.toString());

            let response = await prompt.get({
                description: 'Vuoi riprendere il lavoro precedente?\n1 - Si\n2 - No'
            });

            if (response.question == '1') {
                mode = 'jenkins';
                executeGenerate = false;
                executeTests = false;
            }
        }
    } catch (e) {
        //console.log('No previous data: ', e);
    }

    if (mode !== 'jenkins') {
        let response = await prompt.get({
            description: 'Quale modalità vuoi avviare?\n1 - Deploy completo senza test\n2 - Deploy completo con test\n3 - Deploy completo con test + generazione mocks\n4 - Solo test\n5 - Solo generazione\n6 - Creazione e approvazione merge request\n7 - Approva merge requests'
        });

        if (response.question == '1') {
            mode = 'full';
            executeGenerate = false;
            executeTests = false;
        } else if (response.question == '2') {
            mode = 'full';
            executeGenerate = false;
            executeTests = true;
        } else if (response.question == '3') {
            mode = 'full';
            executeGenerate = true;
            executeTests = true;
        } else if (response.question == '4') {
            mode = 'test';
            executeGenerate = false;
            executeTests = false;
        } else if (response.question == '5') {
            mode = 'generate';
            executeGenerate = false;
            executeTests = false;
        } else if (response.question == '6') {
            mode = 'createAndApproveMergeRequests';
            executeGenerate = false;
            executeTests = false;
        } else if (response.question == '7') {
            mode = 'approveMergeRequests';
            executeGenerate = false;
            executeTests = false;
        } else if (response.question == '8') {
            mode = 'full';
            executeGenerate = false;
            executeTests = false;
            fixFormatEachBranch = true;
        } else if (response.question == '9') {
            mode = 'branch';
            executeGenerate = false;
            executeTests = false;
        }

        if (mode == 'full') {
            try {
                fs.unlinkSync(runnngJobsPath);
                fs.unlinkSync(commitsPath);
                fs.unlinkSync(mergeRequestsPath);
            } catch (e) {
                //console.log('No previous data: ', e);
            }

            runningJobs = [];
            mergeRequests = {};
            commits = {};

            await doMergeAndPush(fixFormatEachBranch);

            await prompt.get({
                description: 'Merge e push completati. Premi un tasto per proseguire con il setup dei puntamenti locali (potrebbe volerci del tempo)'
            });

            if (operatingSystem === 'mac') {
                await exec('rps setup local')
            } else {
                await exec('cd .. && python ./ib_flutter_app_banca/tool/init.py localDep && python ./ib_flutter_app_banca/tool/init.py getAll && cd ./ib_flutter_app_banca')
            }

            await prompt.get({
                description: 'Puntamenti locali impostati. Premi un tasto per proseguire con il format e apply fix.'
            });

            await doFormatAndFix();

            if (executeGenerate) {
                await doRunGenerate();
            }

            if (executeTests) {
                await doFlutterTests();
            }

            await prompt.get({
                description: 'Effettua tutte le fix di analyze rimanenti SENZA committare o pushare. Quando hai terminato, premi un tasto per continuare'
            })

            await doResetRemoteDependencies();

            await prompt.get({
                description: 'Puntamenti remoti ripristinati. Premi un tasto per continuare'
            })

            await doPushAnalyzeFixes();

            await prompt.get({
                description: 'Push dei fix terminato. Quando hai terminato, premi un tasto per continuare'
            })

            await doSetVersions();

            await prompt.get({
                description: 'Versioni impostate. Quando hai terminato, premi un tasto per continuare'
            });

            commits = await doPushVersions();

            fs.writeFile(commitsPath, JSON.stringify(commits), 'utf8', function (err) {
                if (err) return console.log(err);
            });

            await prompt.get({
                description: 'Push completato. Premi un tasto per procedere con le merge request'
            });

            mergeRequests = await doMergeRequests();

            fs.writeFile(mergeRequestsPath, JSON.stringify(mergeRequests), 'utf8', function (err) {
                if (err) return console.log(err);
            });

            await prompt.get({
                description: 'Merge request create. Premi un tasto per procedere con le build'
            });

            await approveMergeRequests(commits, mergeRequests, 1);
        } else if (mode == 'jenkins') {
            let inProgressJobs = JSON.parse(JSON.stringify(runningJobs)).filter((job: any) => job.status === 'IN_PROGRESS');

            if (inProgressJobs.length > 0) {
                let parallelGroup = inProgressJobs[0].parallelGroup;
                console.log(`deploy - riprendi lavoro precedente - parallelGroup: ${parallelGroup}`);
                await doManageDeploys(commits, mergeRequests, parallelGroup);
            } else {
                let lastParallelGroup = runningJobs.reduce((max: number, job: any) => job.parallelGroup > max ? job.parallelGroup : max, 0);
                console.log(`deploy - riprendi lavoro precedente - lastParallelGroup: ${lastParallelGroup}`);
                await doManageDeploys(commits, mergeRequests, lastParallelGroup);
            }
        } else if (mode == 'test') {
            if (operatingSystem === 'mac') {
                await exec('rps setup local')
            } else {
                await exec('cd .. && python ./ib_flutter_app_banca/tool/init.py localDep && python ./ib_flutter_app_banca/tool/init.py getAll && cd ./ib_flutter_app_banca')
            }
            await doFlutterTests();
            await doResetRemoteDependencies();
        } else if (mode == 'generate') {
            if (operatingSystem === 'mac') {
                await exec('rps setup local')
            } else {
                await exec('cd .. && python ./ib_flutter_app_banca/tool/init.py localDep && python ./ib_flutter_app_banca/tool/init.py getAll && cd ./ib_flutter_app_banca')
            }
            await doRunGenerate();
            await doResetRemoteDependencies();
        } else if (mode == 'createAndApproveMergeRequests') {
            mergeRequests = await doMergeRequests();

            fs.writeFile(mergeRequestsPath, JSON.stringify(mergeRequests), 'utf8', function (err) {
                if (err) return console.log(err);
            });

            await prompt.get({
                description: 'Merge request create. Premi un tasto per procedere con le build'
            });

            await approveMergeRequests(commits, mergeRequests, 1);
        } else if (mode == 'approveMergeRequests') {
            try {
                let jsonCommits = fs.readFileSync(commitsPath);
                let jsonMergeRequests = fs.readFileSync(mergeRequestsPath);
                if (jsonCommits && jsonMergeRequests) {
                    commits = JSON.parse(jsonCommits.toString());
                    mergeRequests = JSON.parse(jsonMergeRequests.toString());

                    await approveMergeRequests(commits, mergeRequests, 1);
                }
            } catch (e) {
                console.log('No previous data: ', e);
            }
        } else if (mode == 'branch') {
            await createBranches();
        }
    }
}

async function createBranches() {
    for (let moduleName of deloitteModules) {
        console.log(`createBranches ${moduleName}`);
        let module = modules.find(m => m.name === moduleName);

        if (!module) {
            console.log(`createBranches ${moduleName} - module not found. Exiting`);
            process.exit();
        }

        let newBranch = 'feature/248535_236339_236340';
        let sourceBranch = 'feature/247787_236339_236340';
        let url = `https://git.gbm.lan/api/v4/projects/${module.gitlabProjectId}/repository/branches?private_token=${gitlabToken}&branch=${newBranch}&ref=${sourceBranch}`;
        let body = {};

        let result: any = await httpRequest(url, 'POST', body);

        let jsonResult = JSON.parse(result.toString());
        console.log(`createBranches ${moduleName} - branch created: ${JSON.stringify(jsonResult)}`);
    }
}

async function doMergeAndPush(fixFormatEachBranch: boolean = false) {
    for (let module of modules) {
        process.chdir('../' + module.name);
        console.log(`doMergeAndPush ${module.name} - move to folder ${process.cwd()}`);

        let remotes = await git.getRemotes();
        console.log(`doMergeAndPush ${module.name} - remotes: ${JSON.stringify(remotes)}`);

        for (let branch of module.branches) {
            await git.reset(ResetMode.HARD);
            await git.checkout(branch);
            console.log(`doMergeAndPush ${module.name} - checkout on branch ${branch}`);

            let pullResult = await git.pull(remotes[0].name, branch)
            console.log(`doMergeAndPush ${module.name} - pull ${remotes[0].name} from branch ${branch}. Result: ${JSON.stringify(pullResult)}`);

            if (fixFormatEachBranch) {
                console.log(`doFormatAndFix ${module.name} - move to folder ${process.cwd()}`);

                await exec('dart format -l 120 .')
                await exec('dart fix --apply')

                await git.add('.');

                let rfc = branch.split('/')[1];
                await git.commit(`refs #${rfc} - Analyze fix`);

                console.log(`doFormatAndFix ${module.name} - pushing changes`);
                await git.push();
                console.log(`doFormatAndFix ${module.name} - pushing changes OK`);
            }
        }

        for (let i = 1; i < module.branches.length; i++) {
            await git.checkout(module.branches[i]);
            console.log(`doMergeAndPush ${module.name} - merge - checkout on branch ${module.branches[i]}`);
            let fromMergeBranch = module.branches[i];
            let intoMergeBranch = module.branches[i - 1];
            console.log(`doMergeAndPush ${module.name} - starting merge ${intoMergeBranch} into ${fromMergeBranch}`);
            let mergeResult = await git.mergeFromTo(fromMergeBranch, intoMergeBranch);
            console.log(`doMergeAndPush ${module.name} - merge ${intoMergeBranch} into ${fromMergeBranch}. Result: ${JSON.stringify(mergeResult)}`);

            if (mergeResult.failed) {
                console.log(`doMergeAndPush ${module.name} - merge failed. Exiting`);
                process.exit();
            }

            await git.push();
        }
    }
}

async function doFormatAndFix() {
    for (let module of modules) {
        process.chdir('../' + module.name);
        console.log(`doFormatAndFix ${module.name} - move to folder ${process.cwd()}`);

        await exec('dart format -l 120 .')
        await exec('dart fix --apply')
    }
}

async function doRunGenerate() {
    for (let module of modules) {
        process.chdir('../' + module.name);
        console.log(`doRunGenerate ${module.name} - move to folder ${process.cwd()}`);

        await exec('flutter pub run build_runner build --delete-conflicting-outputs')
    }
}

async function doFlutterTests() {
    for (let module of modules) {
        process.chdir('../' + module.name);
        console.log(`doFlutterTests ${module.name} - move to folder ${process.cwd()}`);

        await exec('flutter test')
    }
}

async function doResetRemoteDependencies() {
    for (let module of modules) {
        process.chdir('../' + module.name);
        console.log(`doResetRemoteDependencies ${module.name} - move to folder ${process.cwd()}`);

        await git.checkout(['pubspec.yaml'])
    }
}

async function doSetVersions() {
    let newVersions: any = {};
    let currentVersions: any = {};
    for (let module of modules) {
        process.chdir('../' + module.name);
        await git.reset(ResetMode.HARD);
        await git.checkout(module.branches[module.branches.length - 1]);
        let buffer = fs.readFileSync(`${process.cwd()}/pubspec.yaml`);
        let currentVersion = getPubspecVersion(buffer.toString());
        console.log(`doSetVersions ${module.name} - pubspec.yaml version: ${currentVersion}`);

        let newVersion = '';
        if (module.name === 'ib_flutter_app_banca') {
            // 12407.0.11+12407011
            let currentYear = new Date().getFullYear().toString();
            let currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
            let lastVersion = currentVersion.split('+')[0];
            let lastVersionParts = lastVersion.split('.');
            let incremental = parseInt(lastVersionParts[2]);
            let newPrefix = `1${currentYear.substring(2, 4)}${currentMonth}`;

            console.log(`doSetVersions ${module.name} - currentYear: ${currentYear} - currentMonth: ${currentMonth}`);
            console.log(`doSetVersions ${module.name} - lastVersion: ${lastVersion} - lastVersionParts: ${lastVersionParts} - incremental: ${incremental} - newPrefix: ${newPrefix}`);

            if (newPrefix !== lastVersionParts[0]) {
                incremental = 1;
            } else {
                incremental++;
            }

            newVersion = `${newPrefix}.0.${incremental}+${newPrefix}${incremental.toString().padStart(3, '0')}`;
            appBancaVersion = newVersion;
        } else {
            let numberVersion = currentVersion.replace('0.0.', '').replace('-SNAPSHOT', '');
            newVersion = `0.0.${parseInt(numberVersion) + 1}-SNAPSHOT`;
        }

        console.log(`doSetVersions ${module.name} - new version: ${newVersion}`);
        let newContent = buffer.toString().replace(`version: ${currentVersion}`, `version: ${newVersion}`);

        fs.writeFile(`${process.cwd()}/pubspec.yaml`, newContent, 'utf8', function (err) {
            if (err) return console.log(err);
        });

        if (module.name === 'ib_flutter_app_banca') {
            if (operatingSystem === 'mac') {
                await exec(`cp -Rf ${process.cwd()}/assets/* ${process.cwd()}/bridge/assets`)
            } else {
                await exec(`xcopy /s/Y "${process.cwd()}/assets" "${process.cwd()}/bridge/assets"`)
            }


            let bridgeBuffer = fs.readFileSync(`${process.cwd()}/bridge/pubspec.yaml`);
            let newBridgeContent = bridgeBuffer.toString().replace(`version: ${currentVersion}`, `version: ${newVersion}`);
            console.log(`doSetVersions ${module.name} - updating bridge/pubspec.yaml current dir: ${process.cwd()}`)
            console.log(`doSetVersions ${module.name} - updating bridge/pubspec.yaml with new version: ${newVersion}`)
            fs.writeFile(`${process.cwd()}/bridge/pubspec.yaml`, newBridgeContent, 'utf8', function (err) {
                if (err) return console.log(err);
            });
        }

        currentVersions[module.name] = currentVersion;
        newVersions[module.name] = newVersion;
    }

    for (let module of modules) {
        //cross_flutter_libarch_shared: '>= 0.0.230-SNAPSHOT <1.0.0'
        process.chdir('../' + module.name);

        await git.checkout(module.branches[module.branches.length - 1]);
        console.log(`doSetVersions ${module.name} - updating dependencies into ${process.cwd()}`);
        let buffer = fs.readFileSync(`${process.cwd()}/pubspec.yaml`);
        let newContent = buffer.toString();

        for (let [key, value] of Object.entries(newVersions)) {
            let currentDependencyVersion = getPubspecDependencyVersion(key, buffer.toString());
            console.log(`doSetVersions ${module.name} - currentDependencyVersion for ${key}: ${currentDependencyVersion}`);
            let currentNumberVersion = currentDependencyVersion.replace(`'>= `, '').replace(` <1.0.0'`, '');
            console.log(`doSetVersions ${module.name} - currentDependencyVersion for ${key} - currentNumberVersion ${currentNumberVersion} - newVersions ${newVersions[key]}`);

            let newDependencyVersion = currentDependencyVersion.replace(currentNumberVersion, newVersions[key]);
            console.log(`doSetVersions ${module.name} - newDependencyVersion for ${key}: ${newDependencyVersion}`);

            console.log(`doSetVersions ${module.name} - replacing ${key}: ${currentDependencyVersion} with ${key}: ${newDependencyVersion}`);
            newContent = newContent.replace(`${key}: ${currentDependencyVersion}`, `${key}: ${newDependencyVersion}`);
        }

        fs.writeFile(`${process.cwd()}/pubspec.yaml`, newContent, 'utf8', function (err) {
            if (err) return console.log(err);
        });
    }
}

async function doPushAnalyzeFixes() {
    console.log(`doPushAnalyzeFixes - start`);
    let commits: any = {};
    for (let module of modules) {
        process.chdir('../' + module.name);
        //console.log(`doPushAnalyzeFixes ${module.name} - move to folder ${process.cwd()}`);

        await git.add('.');
        let rfc = module.branches[module.branches.length - 1].split('/')[1];
        let commitResult = await git.commit(`refs #${rfc} - Analyze fix`);
        commits[module.name] = commitResult.commit;
        await git.push();
    }

    return commits;
}

async function doPushVersions() {
    console.log(`doPushVersions - start`);
    let commits: any = {};
    for (let module of modules) {
        process.chdir('../' + module.name);
        //console.log(`doPushVersions ${module.name} - move to folder ${process.cwd()}`);

        await git.add('.');
        let rfc = module.branches[module.branches.length - 1].split('/')[1];
        let commitResult = await git.commit(`refs #${rfc} - Updated version and analyze`);
        commits[module.name] = commitResult.commit;
        await git.push();
    }

    return commits;
}

async function doMergeRequests() {
    console.log(`doMergeRequests - start`);
    let mergeRequests: any = {};
    for (let module of modules) {
        let url = `https://git.gbm.lan/api/v4/projects/${module.gitlabProjectId}/merge_requests?private_token=${gitlabToken}`;
        let sourceBranch = module.branches[module.branches.length - 1];
        let comment = sourceBranch.split('/')[1];
        let targetBranch = module.name === 'ib_flutter_app_banca' ? 'systemtest' : 'develop';
        let body = {
            "source_branch": sourceBranch,
            "target_branch": targetBranch,
            "remove_source_branch": false,
            "title": `refs #${comment} - pipeline ${targetBranch}`,
            "description": `version ${appBancaVersion}`
        };

        //console.log(`doMergeRequests ${module.name} - start creating merge request with body ${JSON.stringify(body)}`)
        let result: any = await httpRequest(url, 'POST', body);

        let jsonResult = JSON.parse(result.toString());
        mergeRequests[module.name] = {
            iid: jsonResult.iid,
            merge_commit_sha: null,
        }

        console.log(`doMergeRequests ${module.name} - merge request created: ${mergeRequests[module.name]}`)
    }

    return mergeRequests
}

async function approveMergeRequests(commits: any, mergeRequests: any, parallelGroup: number) {
    /*await prompt.get({
        description: 'Inizio approvazione merge request gruppo ' + parallelGroup + '. Premi un tasto per continuare'
    });*/
    console.log('Inizio approvazione merge request gruppo ' + parallelGroup + '. Premi un tasto per continuare')

    await sleep(3000);

    let modulesToApprove = modules.filter(module => module.parallelGroup === parallelGroup);

    if (modulesToApprove.length === 0) {
        console.log(`approveMergeRequests - no modules to approve. Exiting`);
        process.exit();
    }

    for (let module of modulesToApprove) {
        let mergeRequestId = mergeRequests[module.name].iid;
        let url = `https://git.gbm.lan/api/v4/projects/${module.gitlabProjectId}/merge_requests/${mergeRequestId}/merge?private_token=${gitlabToken}`;

        console.log(`approveMergeRequests ${module.name} - approving merge request ${url}`);

        let body = {
            "merge_commit_message": `pipeline develop`
        };
        let mergeResult: any = await httpRequest(url, 'PUT', body);
        console.log(`approveMergeRequests ${module.name} - mergeResult: ${mergeResult}`);
        let jsonResult = JSON.parse(mergeResult.toString());

        mergeRequests[module.name].merge_commit_sha = jsonResult.merge_commit_sha;

        runningJobs.push({
            "module": module.name,
            "status": "IN_PROGRESS",
            "commit": commits[module.name],
            "parallelGroup": parallelGroup,
            "startedAt": new Date().toISOString()
        })

        fs.writeFile(runnngJobsPath, JSON.stringify(runningJobs), 'utf8', function (err) {
            if (err) return console.log(err);
        });

        fs.writeFile(mergeRequestsPath, JSON.stringify(mergeRequests), 'utf8', function (err) {
            if (err) return console.log(err);
        });

        await sleep(30000);
    }

    await doManageDeploys(commits, mergeRequests, parallelGroup);
}

async function doManageDeploys(commits: any, mergeRequests: any, parallelGroup: number) {
    console.log(`doManageDeploys - parallelGroup: ${parallelGroup}`);
    let inProgressJobs = JSON.parse(JSON.stringify(runningJobs)).filter((job: any) => job.status === 'IN_PROGRESS');

    for (let job of inProgressJobs) {
        let module = job.module;
        let commit = job.commit;
        let moduleJenkinsStatus = await getModuleJenkinsStatus(commit, module, mergeRequests);
        //console.log(`doManageDeploys ${module} - moduleJenkinsStatus: ${JSON.stringify(moduleJenkinsStatus)}`);

        if (moduleJenkinsStatus) {
            if (moduleJenkinsStatus.building) {
                console.log(`doManageDeploys ${module} - build is in progress`);
                runningJobs.find(jb => jb.module == module).lastUpdateAt = new Date().toISOString();
            } else if (moduleJenkinsStatus.result === 'SUCCESS') {
                console.log(`doManageDeploys ${module} - build is COMPLETED`);
                runningJobs.find(jb => jb.module == module).status = 'COMPLETED';
                runningJobs.find(jb => jb.module == module).endedAt = new Date().toISOString();
            } else if (moduleJenkinsStatus.result !== 'ABORTED') {
                console.log(`doManageDeploys ${module} - build is FAILED`);
                runningJobs.find(jb => jb.module == module).status = 'FAILED';
                runningJobs.find(jb => jb.module == module).endedAt = new Date().toISOString();
            }
        }
    }

    fs.writeFile(runnngJobsPath, JSON.stringify(runningJobs), 'utf8', function (err) {
        if (err) return console.log(err);
    });

    let pendingJobsSameGroup = JSON.parse(JSON.stringify(runningJobs)).filter((job: any) => job.parallelGroup === parallelGroup && job.status === 'IN_PROGRESS');
    let failedJobsSameGroup = JSON.parse(JSON.stringify(runningJobs)).filter((job: any) => job.parallelGroup === parallelGroup && job.status === 'FAILED');
    let completedJobsSameGroup = JSON.parse(JSON.stringify(runningJobs)).filter((job: any) => job.parallelGroup === parallelGroup && job.status === 'COMPLETED');

    let modulesInGroup = modules.filter(module => module.parallelGroup === parallelGroup);

    console.log(`doManageDeploys - pendingJobsSameGroup: ${pendingJobsSameGroup.length} - failedJobsSameGroup: ${failedJobsSameGroup.length} - completedJobsSameGroup: ${completedJobsSameGroup.length} - modulesInGroup: ${modulesInGroup.length}`)

    if (pendingJobsSameGroup.length === 0 && failedJobsSameGroup.length === 0 && completedJobsSameGroup.length === modulesInGroup.length) {
        console.log(`doManageDeploys - all jobs in parallelGroup ${parallelGroup} are completed`);

        setTimeout(async () => {
            await approveMergeRequests(commits, mergeRequests, parallelGroup + 1);
        }, 5000);
    } else if (pendingJobsSameGroup.length === 0 && failedJobsSameGroup.length > 0) {
        console.log(`doManageDeploys - some jobs in parallelGroup ${parallelGroup} failed. Exiting`);
        process.exit();
    } else {
        setTimeout(async () => {
            console.log(`doManageDeploys - waiting 20 seconds before checking again`);
            await doManageDeploys(commits, mergeRequests, parallelGroup);
        }, 20000);
    }
}

async function getModuleJenkinsStatus(commit: string, module: string, mergeRequests: any) {
    let jenkinsJob = modules.find(m => m.name === module)?.jenkinsJob;

    if (!jenkinsJob) {
        console.log(`${module} - getModuleJenkinsStatus - jenkinsJob not found for module ${module}. Exiting`);
        process.exit();
    }

    console.log(`${module} - getModuleJenkinsStatus - jenkinsJob: ${jenkinsJob} - commit: ${commit}`);

    if (!jenkinsBuildNumbers[module]) {
        if (!mergeRequests[module].merge_commit_sha) {
            console.log(`${module} - getModuleJenkinsStatus - mergeRequests[module].merge_commit_sha not found. Finding it.`);
            mergeRequests[module].merge_commit_sha = await getMergeRequestCommitSha(module, mergeRequests[module].iid);
            fs.writeFile(mergeRequestsPath, JSON.stringify(mergeRequests), 'utf8', function (err) {
                if (err) return console.log(err);
            });
        }

        jenkinsBuildNumbers[module] = await getJenkinsBuildNumber(mergeRequests[module].merge_commit_sha, module);
    }

    console.log(`${module} - getModuleJenkinsStatus - jenkinsJob: ${jenkinsJob} - jenkinsBuildNumbers[module]: ${jenkinsBuildNumbers[module]}`);
    const buildInfo = await jenkins.build.get(jenkinsJob, jenkinsBuildNumbers[module]);

    console.log(`${module} - getModuleJenkinsStatus - buildInfo description: ${buildInfo.description} - building: ${buildInfo.building} - result: ${buildInfo.result}`);

    return buildInfo;
}

async function getMergeRequestCommitSha(module: string, mergeRequestId: number) {
    let url = `https://git.gbm.lan/api/v4/projects/${modules.find(m => m.name === module)?.gitlabProjectId}/merge_requests/${mergeRequestId}?private_token=${gitlabToken}`;
    let result: any = await httpRequest(url, 'GET', {});

    let jsonResult = JSON.parse(result.toString());
    return jsonResult.sha;
}

async function getJenkinsBuildNumber(commit: string, module: string) {
    let jenkinsJob = modules.find(m => m.name === module)?.jenkinsJob;

    console.log(`${module} - getJenkinsBuildNumber - jenkinsJob: ${jenkinsJob} - commit: ${commit}`)

    if (!commit) {
        return null;
    }

    let reducedCommit = commit.substring(0, 7);

    console.log(`${module} - getJenkinsBuildNumber - jenkinsJob: ${jenkinsJob} - reducedCommit: ${reducedCommit}`);

    if (!jenkinsJob) {
        console.log(`getJenkinsBuildNumber - jenkinsJob not found for module ${module}. Exiting`);
        process.exit();
    }

    const jobInfo = await jenkins.job.get(jenkinsJob);
    let number;

    for (let build of jobInfo.builds.slice(0, 30)) {
        const buildInfo = await jenkins.build.get(jenkinsJob, build.number);

        console.log(`${module} - getJenkinsBuildNumber - jenkinsJob: ${jenkinsJob} - reducedCommit: ${reducedCommit} - buildInfo description: ${buildInfo.description}`)

        if (buildInfo.description && buildInfo.description.includes(reducedCommit)) {
            number = build.number;
            console.log(`${module} - getJenkinsBuildNumber - jenkinsJob: ${jenkinsJob} - reducedCommit: ${reducedCommit} - FOUND build number: ${build.number}`);
            break;
        }
    }

    if (!number) {
        console.log(`${module} - getJenkinsBuildNumber - jenkinsJob: ${jenkinsJob} - looking for a in progress build for ${module}`);
        let inProgressBuild = jobInfo.builds.find((build: any) => build.building && build.fullDisplayName.includes(module));

        if (inProgressBuild) {
            number = inProgressBuild.number;
            console.log(`${module} - getJenkinsBuildNumber - jenkinsJob: ${jenkinsJob} - FOUND in progress build number: ${number}`);
        } else {
            console.log(`${module} - getJenkinsBuildNumber - jenkinsJob: ${jenkinsJob} - NOT FOUND in progress build number`);
            console.log(`${module} - getJenkinsBuildNumber - jenkinsJob: ${jenkinsJob} - jobInfo.builds: ${JSON.stringify(jobInfo.builds)}`);
        }
    }

    return number;
}

function getPubspecDependencyVersion(dependency: string, content: string): string {
    const lines = content.split('\n');
    const match = lines.find(line => line.includes(`${dependency}: `));
    return match?.split(': ')[1] ?? '';
}

function getPubspecVersion(content: string): string {
    const lines = content.split('\n');
    const match = lines.find(line => line.startsWith('version: '));
    return match?.split(' ')[1] ?? '';
}

async function httpRequest(url: string, method: string, body: any) {
    return new Promise((resolve, reject) => {
        let request = require('request');
        let options = {
            'method': method,
            'url': url,
            "rejectUnauthorized": false,
            'headers': {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)

        };
        request(options, function (error: any, response: any) {
            if (error) throw new Error(error);
            console.log(response.body);
            resolve(response.body);
        });
    });
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

deploy();

//test();

async function test() {
    process.chdir(appBancaDir)
    console.log(`Current directory: ${process.cwd()}`);

    await doRunGenerate();

    await doFlutterTests();

    //const jobInfo = await jenkins.job.get("flutter_lib");
    //console.log(`Jenkins jobInfo: ${JSON.stringify(jobInfo.builds)}`)

    //const buildInfo = await jenkins.build.get("flutter_lib", jobInfo.builds[0].number);

    //console.log(`Jenkins buildInfo: ${JSON.stringify(buildInfo)}`)
    //console.log(`Jenkins buildInfo: ${JSON.stringify(buildInfo)}`)

    /*if (buildInfo.description.includes('refs #243512_219968_219966')) {
        console.log(`Jenkins buildInfo: ${JSON.stringify(buildInfo)}`)
    }*/

    /*for (let build of jobInfo.builds.slice(0, 12)) {
        const buildInfo = await jenkins.build.get("flutter_lib", build.number);

        //console.log(`Jenkins buildInfo: ${JSON.stringify(buildInfo)}`)
        console.log(`Jenkins buildInfo: ${buildInfo.description}`)

        if (buildInfo.description.includes('refs #243512_219968_219966')) {
            console.log(`Jenkins buildInfo: ${JSON.stringify(buildInfo)}`)
        }
    }*/
}

