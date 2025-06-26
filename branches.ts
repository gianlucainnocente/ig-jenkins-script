/*
Aggiornare eventualmente il branch MVP
 */
export const stream23Branch = 'feature/268960_268961_268962';
export const polizzeBranch = 'feature/258251_258255_258256';

export const rewardingBranch = 'feature/259787_259788_259789';

export const areaDocumentiBranch = 'feature/268960_268961_268962';

export const deloitteModules = [
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
    'ib_flutter_feature_polizze',
    'ib_flutter_feature_rewarding',
    'ib_flutter_feature_areapersonale',
    'ib_flutter_app_banca'
]

export const deloitteModulesToMerge = [
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
    'ib_flutter_feature_areapersonale',
    'ib_flutter_app_banca'
]

export const deloitteModulesToCreateBranch = [
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
    'ib_flutter_feature_areapersonale',
    'ib_flutter_app_banca'
]

export const productionModules = [
    'ib_flutter_lib_a11y_utils',
    'ib_flutter_feature_keyhole',
    'ib_flutter_feature_bollettini',
    'ib_flutter_feature_login',
    'ib_flutter_feature_bonifici',
    'ib_flutter_feature_tributi',
    'ib_flutter_feature_conti',
    'ib_flutter_feature_ricariche',
    'ib_flutter_feature_homepage',
    'ib_flutter_feature_polizze',
    'ib_flutter_app_banca'
]

/*export const carteBranches = [
    'feature/252651_239866_239867'
];

export const tradingBranches = [
    'feature/252654_233675_233674'
];

export const fondiBranches = [
    'feature/239861_239862_239863'
];*/

export const modules = [
    {
        "name": "cross_flutter_libarch_uicomponents",
        "namespace": "architettura",
        "branches": [
            stream23Branch,
        ],
        "parallelGroup": 0,
        "gitlabProjectId": "17003",
        "jenkinsJob": "flutter_lib",
        "autoapprove": false
    },
    {
        "name": "cross_flutter_libarch_shared",
        "namespace": "architettura",
        "branches": [
            stream23Branch,
        ],
        "parallelGroup": 0,
        "gitlabProjectId": "16894",
        "jenkinsJob": "flutter_lib",
        "autoapprove": false
    },
    {
        "name": "ib_flutter_lib_a11y_utils",
        "namespace": "nib",
        "branches": [
            stream23Branch,
        ],
        "parallelGroup": 1,
        "gitlabProjectId": "16898",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true,
        "commitBeforeCheckOut": true
    },
    {
        "name": "ib_flutter_feature_keyhole",
        "namespace": "nib",
        "branches": [
            stream23Branch,
        ],
        "parallelGroup": 2,
        "gitlabProjectId": "18637",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },
    {
        "name": "ib_flutter_feature_bollettini",
        "namespace": "nib",
        "branches": [
            stream23Branch,
        ],
        "parallelGroup": 2,
        "gitlabProjectId": "16937",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },
    {
        "name": "ib_flutter_feature_login",
        "namespace": "nib",
        "branches": [
            stream23Branch,
        ],
        "parallelGroup": 2,
        "gitlabProjectId": "16902",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },
    {
        "name": "ib_flutter_feature_bonifici",
        "namespace": "nib",
        "branches": [
            stream23Branch,
        ],
        "parallelGroup": 2,
        "gitlabProjectId": "17021",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },
    {
        "name": "ib_flutter_feature_tributi",
        "namespace": "nib",
        "branches": [
            stream23Branch,
        ],
        "parallelGroup": 2,
        "gitlabProjectId": "16933",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },
    {
        "name": "ib_flutter_feature_conti",
        "namespace": "nib",
        "branches": [
            stream23Branch,
        ],
        "parallelGroup": 2,
        "gitlabProjectId": "17017",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },
    /*{
        "name": "ib_flutter_feature_carte",
        "namespace": "nib",
        "branches": carteBranches,
        "parallelGroup": 2,
        "gitlabProjectId": "17220",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },
    {
        "name": "ib_flutter_feature_trading",
        "namespace": "nib",
        "branches": tradingBranches,
        "parallelGroup": 2,
        "gitlabProjectId": "17015",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },*/
    {
        "name": "ib_flutter_feature_ricariche",
        "namespace": "nib",
        "branches": [
            stream23Branch,
        ],
        "parallelGroup": 2,
        "gitlabProjectId": "17087",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },
    {
        "name": "ib_flutter_feature_prelievieversamenti",
        "namespace": "nib",
        "branches": [
            stream23Branch,
        ],
        "parallelGroup": 2,
        "gitlabProjectId": "18847",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },
    {
        "name": "ib_flutter_feature_areapersonale",
        "namespace": "nib",
        "branches": [
            areaDocumentiBranch,
        ],
        "parallelGroup": 2,
        "gitlabProjectId": "19214",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },
    {
        "name": "ib_flutter_feature_homepage",
        "namespace": "nib",
        "branches": [
            stream23Branch,
        ],
        "parallelGroup": 2,
        "gitlabProjectId": "16903",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },
    {
        "name": "ib_flutter_feature_polizze",
        "namespace": "nib",
        "branches": [
            polizzeBranch,
        ],
        "parallelGroup": 2,
        "gitlabProjectId": "19701",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },
    {
        "name": "ib_flutter_feature_rewarding",
        "namespace": "nib",
        "branches": [
            rewardingBranch,
        ],
        "parallelGroup": 2,
        "gitlabProjectId": "19878",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },
    /*{
        "name": "ib_flutter_feature_fondi",
        "namespace": "nib",
        "branches": fondiBranches,
        "parallelGroup": 3,
        "gitlabProjectId": "17930",
        "jenkinsJob": "flutter_lib",
        "autoapprove": true
    },*/
    {
        "name": "ib_flutter_app_banca",
        "namespace": "nib",
        "branches": [
            stream23Branch,
        ],
        "parallelGroup": 3,
        "gitlabProjectId": "16896",
        "jenkinsJob": "flutter_app",
        "autoapprove": true
    }
]
