#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration - UPDATE THE SUPABASE_SERVICE_KEY with your actual key
const REDMINE_BASE_URL = 'http://redmine.gbm.lan:8080';
const REDMINE_API_KEY = 'e69df1f50d938c7da8cb406ba80431bdf27195e9';
const SUPABASE_URL = 'https://zprvhblmsoavgcbgagvi.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwcnZoYmxtc29hdmdjYmdhZ3ZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODIyMzkzMywiZXhwIjoyMDczNzk5OTMzfQ.cH-985j3YeA8JXM6uZPXtiEom34FYh8JNPmmpbfdQkM'; // Get this from Supabase Dashboard > Settings > API
const TARGET_PROJECTS = ['accessibilita-app-mediolanum', 'mobile', 'nuova-offerta-conto-corrente--review-pricing', 'chiusura-selfyconto-da-canali-digitali', 'sviluppi-per-adeguamenti-normativi-sct-instant'];
const SYNC_STATE_FILE = path.join(__dirname, 'redmine-sync-state.json');

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

// Check configuration
if (SUPABASE_SERVICE_KEY === 'YOUR_SUPABASE_SERVICE_KEY_HERE') {
    console.log(`${colors.red}❌ Please update SUPABASE_SERVICE_KEY in the script with your actual service role key.${colors.reset}`);
    console.log(`${colors.blue}💡 Get it from: Supabase Dashboard > Settings > API > Service Role Key${colors.reset}`);
    process.exit(1);
}

console.log(`${colors.blue}🔄 Starting Redmine sync script with pagination and delta sync...${colors.reset}`);

// Function to make HTTP request
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const requestLib = url.startsWith('https') ? https : http;

        const req = requestLib.request(url, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (error) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// Load sync state
function loadSyncState() {
    return { lastSync: null };

    try {
        if (fs.existsSync(SYNC_STATE_FILE)) {
            const state = JSON.parse(fs.readFileSync(SYNC_STATE_FILE, 'utf8'));
            console.log(`${colors.cyan}📋 Loaded sync state - Last sync: ${state.lastSync}${colors.reset}`);
            return state;
        }
    } catch (error) {
        console.log(`${colors.yellow}⚠️  Could not load sync state: ${error.message}${colors.reset}`);
    }

    console.log(`${colors.cyan}📋 No previous sync state found - performing full sync${colors.reset}`);
    return { lastSync: null };
}

// Save sync state
function saveSyncState(state) {
    try {
        fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
        console.log(`${colors.cyan}💾 Saved sync state - Last sync: ${state.lastSync}${colors.reset}`);
    } catch (error) {
        console.log(`${colors.yellow}⚠️  Could not save sync state: ${error.message}${colors.reset}`);
    }
}

// Format date for Redmine API (YYYY-MM-DDTHH:MM:SSZ)
function formatDateForRedmine(date) {
    return date.toISOString();
}

// Test Redmine connectivity
async function testRedmineConnectivity() {
    console.log(`${colors.yellow}📡 Testing Redmine connectivity...${colors.reset}`);

    try {
        const testUrl = `${REDMINE_BASE_URL}/projects.json?limit=1`;
        const response = await makeRequest(testUrl, {
            method: 'GET',
            headers: {
                'X-Redmine-API-Key': REDMINE_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            console.log(`${colors.green}✅ Redmine connection successful${colors.reset}`);
            return true;
        } else {
            console.log(`${colors.red}❌ Redmine connection failed with status: ${response.status}${colors.reset}`);
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}❌ Redmine connection error: ${error.message}${colors.reset}`);
        return false;
    }
}

// Test Supabase connectivity
async function testSupabaseConnectivity() {
    console.log(`${colors.yellow}📡 Testing Supabase connectivity...${colors.reset}`);

    try {
        const response = await makeRequest(`${SUPABASE_URL}/rest/v1/steps?select=count`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            console.log(`${colors.green}✅ Supabase connection successful${colors.reset}`);
            return true;
        } else {
            console.log(`${colors.red}❌ Supabase connection failed with status: ${response.status}${colors.reset}`);
            if (response.status === 401) {
                console.log(`${colors.red}💡 Please check your SUPABASE_SERVICE_KEY${colors.reset}`);
            }
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}❌ Supabase connection error: ${error.message}${colors.reset}`);
        return false;
    }
}

// Check if target projects exist and get issue counts
async function checkProjectsAndCounts(lastSync) {
    console.log(`${colors.yellow}📋 Checking target projects and getting counts...${colors.reset}`);

    const foundProjects = [];
    let totalIssues = 0;
    let deltaIssues = 0;

    for (const projectName of TARGET_PROJECTS) {
        try {
            // Check if project exists
            const projectUrl = `${REDMINE_BASE_URL}/projects/${projectName}.json`;
            const projectResponse = await makeRequest(projectUrl, {
                method: 'GET',
                headers: {
                    'X-Redmine-API-Key': REDMINE_API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            if (projectResponse.status !== 200) {
                console.log(`${colors.red}❌ Project not found: ${projectName} (status: ${projectResponse.status})${colors.reset}`);
                continue;
            }

            console.log(`${colors.green}✅ Project found: ${projectName}${colors.reset}`);
            foundProjects.push(projectName);

            // Get total issues count (assigned to Deloitte)
            const totalUrl = `${REDMINE_BASE_URL}/issues.json?project_id=${projectName}&status_id=*&limit=1&assigned_to_id=1959|3489&include=custom_fields`;
            const totalResponse = await makeRequest(totalUrl, {
                method: 'GET',
                headers: {
                    'X-Redmine-API-Key': REDMINE_API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            if (totalResponse.status === 200 && totalResponse.data.total_count !== undefined) {
                const projectTotal = totalResponse.data.total_count;
                totalIssues += projectTotal;
                console.log(`${colors.blue}📄 Project ${projectName}: ${projectTotal} total issues${colors.reset}`);

                // Get delta issues count if we have last sync time (assigned to Deloitte)
                if (lastSync) {
                    const deltaUrl = `${REDMINE_BASE_URL}/issues.json?project_id=${projectName}&status_id=*&limit=1&updated_on=>=${formatDateForRedmine(new Date(lastSync))}&assigned_to_id=1959|3489&include=custom_fields`;
                    const deltaResponse = await makeRequest(deltaUrl, {
                        method: 'GET',
                        headers: {
                            'X-Redmine-API-Key': REDMINE_API_KEY,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (deltaResponse.status === 200 && deltaResponse.data.total_count !== undefined) {
                        const projectDelta = deltaResponse.data.total_count;
                        deltaIssues += projectDelta;
                        console.log(`${colors.cyan}📊 Project ${projectName}: ${projectDelta} issues updated since last sync${colors.reset}`);
                    }
                }
            } else {
                console.log(`${colors.yellow}⚠️  Could not get issue count for project ${projectName}${colors.reset}`);
            }
        } catch (error) {
            console.log(`${colors.red}❌ Error checking project ${projectName}: ${error.message}${colors.reset}`);
        }
    }

    console.log(`${colors.blue}📊 Total issues across all projects: ${totalIssues}${colors.reset}`);
    if (lastSync && deltaIssues > 0) {
        console.log(`${colors.cyan}📊 Total issues to sync (delta): ${deltaIssues}${colors.reset}`);
    } else if (lastSync && deltaIssues === 0) {
        console.log(`${colors.green}✨ No issues updated since last sync!${colors.reset}`);
    }

    return { foundProjects, totalIssues, deltaIssues };
}

// Fetch all issues from a project with pagination (assigned to Deloitte)
async function fetchAllIssuesFromProject(projectName, lastSync = null) {
    console.log(`${colors.blue}📥 Fetching all issues from project: ${projectName} (assigned to Deloitte)${colors.reset}`);

    let allIssues = [];
    let offset = 0;
    const limit = 100; // Redmine's max limit per request
    let hasMore = true;

    while (hasMore) {
        try {
            let issuesUrl = `${REDMINE_BASE_URL}/issues.json?project_id=${projectName}&status_id=*&limit=${limit}&offset=${offset}&assigned_to_id=1959|3489&include=custom_fields`;

            // Add delta filter if we have last sync time
            if (lastSync) {
                issuesUrl += `&updated_on=>=${formatDateForRedmine(new Date(lastSync))}`;
            }

            const response = await makeRequest(issuesUrl, {
                method: 'GET',
                headers: {
                    'X-Redmine-API-Key': REDMINE_API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status !== 200) {
                console.log(`${colors.red}❌ Failed to fetch issues for ${projectName} at offset ${offset}: ${response.status}${colors.reset}`);
                break;
            }

            const issues = response.data.issues || [];
            const totalCount = response.data.total_count || 0;

            allIssues = allIssues.concat(issues);

            console.log(`${colors.cyan}📄 Fetched ${issues.length} issues (${allIssues.length}/${totalCount}) from ${projectName}${colors.reset}`);

            // Check if we have more issues to fetch
            if (issues.length < limit || allIssues.length >= totalCount) {
                hasMore = false;
            } else {
                offset += limit;
            }

            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            console.log(`${colors.red}❌ Error fetching issues from ${projectName}: ${error.message}${colors.reset}`);
            break;
        }
    }

    console.log(`${colors.green}✅ Fetched ${allIssues.length} total issues from ${projectName}${colors.reset}`);
    return allIssues;
}

// Fetch steps from Supabase
async function fetchSteps() {
    console.log(`${colors.yellow}📋 Fetching steps from Supabase...${colors.reset}`);

    try {
        const response = await makeRequest(`${SUPABASE_URL}/rest/v1/steps?select=*&order=order_position.asc`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            console.log(`${colors.green}✅ Found ${response.data.length} steps in Supabase${colors.reset}`);
            return response.data;
        } else {
            throw new Error(`Failed to fetch steps: ${response.status}`);
        }
    } catch (error) {
        console.log(`${colors.red}❌ Error fetching steps: ${error.message}${colors.reset}`);
        return [];
    }
}

// Fetch user details from cache or Redmine
async function fetchUserDetailsWithCache(userId) {
    if (!userId) return null;

    try {
        // First, check if user exists in cache
        const cacheCheckResponse = await makeRequest(`${SUPABASE_URL}/rest/v1/redmine_users?select=name&id=eq.${userId}`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (cacheCheckResponse.status === 200 && cacheCheckResponse.data && cacheCheckResponse.data.length > 0) {
            // User found in cache
            console.log(`${colors.cyan}💾 Using cached user data for ID ${userId}: ${cacheCheckResponse.data[0].name}${colors.reset}`);
            return cacheCheckResponse.data[0].name;
        }

        // User not in cache, fetch from Redmine
        console.log(`${colors.yellow}🔍 Fetching user details from Redmine for ID ${userId}...${colors.reset}`);
        const userUrl = `${REDMINE_BASE_URL}/users/${userId}.json`;
        const response = await makeRequest(userUrl, {
            method: 'GET',
            headers: {
                'X-Redmine-API-Key': REDMINE_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200 && response.data.user) {
            const user = response.data.user;
            const userName = user.name || `${user.firstname} ${user.lastname}`.trim();

            // Save to cache
            const userData = {
                id: parseInt(userId),
                name: userName,
                firstname: user.firstname || null,
                lastname: user.lastname || null,
                email: user.mail || null
            };

            const cacheResponse = await makeRequest(`${SUPABASE_URL}/rest/v1/redmine_users`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(userData)
            });

            if (cacheResponse.status === 201) {
                console.log(`${colors.green}💾 Cached user data for ID ${userId}: ${userName}${colors.reset}`);
            } else {
                console.log(`${colors.yellow}⚠️  Could not cache user data for ID ${userId}${colors.reset}`);
            }

            return userName;
        }

        return null;
    } catch (error) {
        console.log(`${colors.yellow}⚠️  Could not fetch user details for ID ${userId}: ${error.message}${colors.reset}`);
        return null;
    }
}

// Sync issues to Supabase using bulk operations
async function syncIssues(foundProjects, lastSync) {
    console.log(`${colors.yellow}🚀 Starting sync to Supabase with bulk operations...${colors.reset}`);

    // Fetch steps first
    const steps = await fetchSteps();
    if (steps.length === 0) {
        console.log(`${colors.red}❌ No steps found. Cannot proceed with sync.${colors.reset}`);
        return 0;
    }

    let totalSynced = 0;
    const allIssues = [];
    const allStepRecords = [];

    for (const projectName of foundProjects) {
        console.log(`${colors.blue}📥 Collecting issues from project: ${projectName}${colors.reset}`);

        try {
            // Fetch all issues from this project
            const issues = await fetchAllIssuesFromProject(projectName, lastSync);

            issues.forEach(issue => {
                console.log(`${colors.cyan}🔖 Issue ID ${issue.id}: ${issue.subject} [Project: ${issue.project_name}, Status: ${issue.status_name}]${colors.reset}`);
            });

            if (issues.length === 0) {
                console.log(`${colors.cyan}✨ No issues to sync for project ${projectName}${colors.reset}`);
                continue;
            }

            // Process each issue for bulk operations
            for (let i = 0; i < issues.length; i++) {
                const issue = issues[i];

                try {
                    // Show progress every 50 issues
                    if (i % 50 === 0) {
                        console.log(`${colors.cyan}📊 Processing issue ${i + 1}/${issues.length} for ${projectName}${colors.reset}`);
                    }

                    // Get developer name from custom field ID 5 with caching
                    const developerUserId = issue.custom_fields?.find(cf => cf.id === 5)?.value;
                    const developerName = developerUserId ? await fetchUserDetailsWithCache(developerUserId) : null;

                    const issueData = {
                        id: issue.id,
                        subject: issue.subject,
                        description: issue.description || '',
                        project_id: issue.project.id,
                        project_name: issue.project.name,
                        status_id: issue.status.id,
                        status_name: issue.status.name,
                        priority_id: issue.priority.id,
                        priority_name: issue.priority.name,
                        assigned_to_id: issue.assigned_to?.id || null,
                        assigned_to_name: developerName, // Developer name from user lookup
                        fixed_version_id: issue.fixed_version?.id || null,
                        fixed_version_name: issue.fixed_version?.name || null,
                        created_on: issue.created_on,
                        updated_on: issue.updated_on,
                        synced_at: new Date().toISOString()
                    };

                    allIssues.push(issueData);

                    // Create step records for new issues
                    const stepRecords = steps.map(step => ({
                        issue_id: issue.id,
                        step_id: step.id,
                        completed: false
                    }));
                    allStepRecords.push(...stepRecords);

                } catch (error) {
                    console.log(`${colors.yellow}⚠️  Error processing issue ${issue.id}: ${error.message}${colors.reset}`);
                }
            }
        } catch (error) {
            console.log(`${colors.red}❌ Error collecting issues from ${projectName}: ${error.message}${colors.reset}`);
        }
    }

    console.log(`${colors.blue}📊 Collected ${allIssues.length} issues for bulk operations${colors.reset}`);

    // Bulk upsert issues
    if (allIssues.length > 0) {

        const batchSize = 1000; // Increased batch size for better performance

        for (let i = 0; i < allIssues.length; i += batchSize) {
            const batch = allIssues.slice(i, i + batchSize);
            console.log(`${colors.cyan}📦 Bulk upserting issues batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allIssues.length/batchSize)} (${batch.length} issues)${colors.reset}`);

            const response = await makeRequest(`${SUPABASE_URL}/rest/v1/issues`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(batch)
            });

            if (response.status === 201) {
                totalSynced += batch.length;
                console.log(`${colors.green}✅ Successfully upserted ${batch.length} issues${colors.reset}`);
            } else {
                console.log(`${colors.red}❌ Failed to bulk upsert issues batch: ${response.status}${colors.reset}`);
            }

            // Small delay between batches
            if (i + batchSize < allIssues.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        // Bulk upsert issue steps
        if (allStepRecords.length > 0) {
            console.log(`${colors.blue}📊 Bulk upserting ${allStepRecords.length} step records${colors.reset}`);
            const stepBatchSize = 5000; // Steps can handle larger batches

            for (let i = 0; i < allStepRecords.length; i += stepBatchSize) {
                const batch = allStepRecords.slice(i, i + stepBatchSize);
                console.log(`${colors.cyan}📦 Bulk upserting step records batch ${Math.floor(i/stepBatchSize) + 1}/${Math.ceil(allStepRecords.length/stepBatchSize)} (${batch.length} records)${colors.reset}`);

                const response = await makeRequest(`${SUPABASE_URL}/rest/v1/issue_steps`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=ignore-duplicates' // Don't overwrite existing step progress
                    },
                    body: JSON.stringify(batch)
                });

                if (response.status === 201) {
                    console.log(`${colors.green}✅ Successfully upserted step records batch ${Math.floor(i/stepBatchSize) + 1}${colors.reset}`);
                } else {
                    console.log(`${colors.yellow}⚠️  Failed to bulk upsert step records batch: ${response.status}${colors.reset}`);
                }

                // Small delay between batches
                if (i + stepBatchSize < allStepRecords.length) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }
    }

    return totalSynced;
}

// Main execution
async function main() {
    const startTime = new Date();
    console.log(`${colors.blue}🚀 Sync started at: ${startTime.toISOString()}${colors.reset}`);

    try {
        // Load previous sync state
        const syncState = loadSyncState();

        // Test connectivity
        const redmineConnected = await testRedmineConnectivity();
        if (!redmineConnected) {
            console.log(`${colors.red}❌ Cannot connect to Redmine. Please check the URL and API key.${colors.reset}`);
            process.exit(1);
        }

        const supabaseConnected = await testSupabaseConnectivity();
        if (!supabaseConnected) {
            console.log(`${colors.red}❌ Cannot connect to Supabase. Please check the service key.${colors.reset}`);
            process.exit(1);
        }

        // Check projects and get counts
        const { foundProjects, totalIssues, deltaIssues } = await checkProjectsAndCounts(syncState.lastSync);

        if (foundProjects.length === 0) {
            console.log(`${colors.red}❌ No target projects found in Redmine.${colors.reset}`);
            process.exit(1);
        }

        // Skip sync if no delta issues
        if (syncState.lastSync && deltaIssues === 0) {
            console.log(`${colors.green}✨ No issues updated since last sync. Nothing to do!${colors.reset}`);
            process.exit(0);
        }

        // Sync issues to Supabase
        const totalSynced = await syncIssues(foundProjects, syncState.lastSync);

        // Save sync state
        const newSyncState = {
            lastSync: startTime.toISOString(),
            totalSynced,
            projects: foundProjects
        };
        saveSyncState(newSyncState);

        const endTime = new Date();
        const duration = Math.round((endTime - startTime) / 1000);

        console.log(`${colors.green}🎉 Sync script completed successfully!${colors.reset}`);
        console.log(`${colors.blue}📊 Total issues processed: ${totalSynced}${colors.reset}`);
        console.log(`${colors.blue}⏱️  Duration: ${duration} seconds${colors.reset}`);
        console.log(`${colors.blue}🕐 Completed at: ${endTime.toISOString()}${colors.reset}`);

    } catch (error) {
        console.log(`${colors.red}❌ Script error: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// Run the script
main();
