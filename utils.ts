export class Utils {
    static isValidRFCBranch(branchName: string, rfc: string): boolean {
        return branchName.includes(rfc) &&
            !branchName.includes('del-dev') &&
            !branchName.includes('del-sys');
    }

    static normalizeBranchName(branchName: string): string {
        const branch = branchName.replace(/origin_[^/]+/, "origin");
        return (branch.startsWith('remotes/origin/')
            ? branch.replace(/^remotes\/origin\//, '')
            : branch);
    }
}
