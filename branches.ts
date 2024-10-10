/*
Aggiornare eventualmente il branch MVP
 */
export const mvpBranch = 'feature/248921_219968_219966';
export const stream2ABranch = 'feature/248922_236339_236340';
export const stream3ABranch = 'feature/236348_236342_236341';

export const deloitteModules = [
    'cross_flutter_libarch_uicomponents',
    'cross_flutter_libarch_shared',
    'ib_flutter_lib_a11y_utils',
    'ib_flutter_feature_keyhole',
    'ib_flutter_feature_bollettini',
    'ib_flutter_feature_login',
    'ib_flutter_feature_bonifici',
    'ib_flutter_feature_tributi',
    'ib_flutter_feature_conti',
    'ib_flutter_feature_ricariche',
    'ib_flutter_feature_prelievieversamenti',
    'ib_flutter_feature_homepage',
    'ib_flutter_app_banca'
]

export const carteBranches = [
    'feature/239865_239866_239867',
    'feature/239869_239870_239871'
];

export const tradingBranches = [
    'feature/233673_233675_233674'
];

export const fondiBranches = [
    'feature/238318_238316_238315',
    'feature/239860_239858_239859',
];

export const modules = [
    {
        "name": "cross_flutter_libarch_uicomponents",
        "namespace": "architettura",
        "branches": [
            mvpBranch,
            stream2ABranch,
            stream3ABranch,
        ],
        "parallelGroup": 1,
        "gitlabProjectId": "17003",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "cross_flutter_libarch_shared",
        "namespace": "architettura",
        "branches": [
            mvpBranch,
            stream2ABranch,
            stream3ABranch,
        ],
        "parallelGroup": 1,
        "gitlabProjectId": "16894",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "ib_flutter_lib_a11y_utils",
        "namespace": "nib",
        "branches": [
            mvpBranch,
            stream2ABranch,
            stream3ABranch,
        ],
        "parallelGroup": 2,
        "gitlabProjectId": "16898",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "ib_flutter_feature_keyhole",
        "namespace": "nib",
        "branches": [
            mvpBranch,
            stream2ABranch,
            stream3ABranch,
        ],
        "parallelGroup": 3,
        "gitlabProjectId": "18637",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "ib_flutter_feature_bollettini",
        "namespace": "nib",
        "branches": [
            mvpBranch,
            stream2ABranch,
            stream3ABranch,
        ],
        "parallelGroup": 3,
        "gitlabProjectId": "16937",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "ib_flutter_feature_login",
        "namespace": "nib",
        "branches": [
            mvpBranch,
            stream2ABranch,
            stream3ABranch,
        ],
        "parallelGroup": 3,
        "gitlabProjectId": "16902",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "ib_flutter_feature_bonifici",
        "namespace": "nib",
        "branches": [
            mvpBranch,
            stream2ABranch,
            stream3ABranch
        ],
        "parallelGroup": 3,
        "gitlabProjectId": "17021",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "ib_flutter_feature_tributi",
        "namespace": "nib",
        "branches": [
            mvpBranch,
            stream2ABranch,
            stream3ABranch
        ],
        "parallelGroup": 3,
        "gitlabProjectId": "16933",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "ib_flutter_feature_conti",
        "namespace": "nib",
        "branches": [
            mvpBranch,
            stream2ABranch,
            stream3ABranch,
        ],
        "parallelGroup": 3,
        "gitlabProjectId": "17017",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "ib_flutter_feature_carte",
        "namespace": "nib",
        "branches": carteBranches,
        "parallelGroup": 3,
        "gitlabProjectId": "17220",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "ib_flutter_feature_trading",
        "namespace": "nib",
        "branches": tradingBranches,
        "parallelGroup": 3,
        "gitlabProjectId": "17015",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "ib_flutter_feature_ricariche",
        "namespace": "nib",
        "branches": [
            mvpBranch,
            stream2ABranch,
            stream3ABranch
        ],
        "parallelGroup": 3,
        "gitlabProjectId": "17087",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "ib_flutter_feature_prelievieversamenti",
        "namespace": "nib",
        "branches": [
            stream3ABranch
        ],
        "parallelGroup": 3,
        "gitlabProjectId": "18847",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "ib_flutter_feature_homepage",
        "namespace": "nib",
        "branches": [
            mvpBranch,
            stream2ABranch,
            stream3ABranch
        ],
        "parallelGroup": 3,
        "gitlabProjectId": "16903",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "ib_flutter_feature_fondi",
        "namespace": "nib",
        "branches": fondiBranches,
        "parallelGroup": 3,
        "gitlabProjectId": "17930",
        "jenkinsJob": "flutter_lib"
    },
    {
        "name": "ib_flutter_app_banca",
        "namespace": "nib",
        "branches": [
            mvpBranch,
            stream2ABranch,
            stream3ABranch,
        ],
        "parallelGroup": 4,
        "gitlabProjectId": "16896",
        "jenkinsJob": "flutter_app"
    }
]
