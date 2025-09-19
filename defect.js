#!/usr/bin/env node

/**
 * Script per importare defect da file Excel in Supabase
 *
 * Utilizzo:
 * node defect.js <percorso-file-excel>
 *
 * Esempio:
 * node defect.js ./Octane_defects_filtered_19_09_2025_12_54_11.xlsx
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// Configurazione Supabase
const SUPABASE_URL = 'https://zprvhblmsoavgcbgagvi.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwcnZoYmxtc29hdmdjYmdhZ3ZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODIyMzkzMywiZXhwIjoyMDczNzk5OTMzfQ.cH-985j3YeA8JXM6uZPXtiEom34FYh8JNPmmpbfdQkM';

if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ ERRORE: Variabile d\'ambiente SUPABASE_SERVICE_KEY non configurata');
    console.log('💡 Configura la chiave con: export SUPABASE_SERVICE_KEY="your_service_key"');
    process.exit(1);
}

// Inizializza il client Supabase con la service key per operazioni admin
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

/**
 * Converte una data in formato Excel/stringa in timestamp ISO
 */
function parseExcelDate(dateValue) {
    if (!dateValue) return null;

    try {
        let date;

        // Se è un numero (formato Excel)
        if (typeof dateValue === 'number') {
            // Excel dates are stored as days since 1900-01-01
            date = new Date((dateValue - 25569) * 86400 * 1000);
        } else if (typeof dateValue === 'string') {
            // Prova a parsare come stringa
            if (dateValue.includes('/')) {
                // Formato MM/DD/YY HH:MM
                const parts = dateValue.split(' ');
                const datePart = parts[0];
                const timePart = parts[1] || '00:00';

                const [month, day, year] = datePart.split('/').map(Number);
                const fullYear = year < 50 ? 2000 + year : 1900 + year;

                date = new Date(`${fullYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${timePart}:00`);
            } else {
                date = new Date(dateValue);
            }
        } else {
            return null;
        }

        // Verifica che la data sia valida
        if (isNaN(date.getTime())) {
            return null;
        }

        return date.toISOString();
    } catch (error) {
        console.warn(`⚠️  Errore parsing data "${dateValue}":`, error.message);
        return null;
    }
}

/**
 * Legge e processa il file Excel
 */
function readExcelFile(filePath) {
    try {
        console.log(`📖 Lettura file: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            throw new Error(`File non trovato: ${filePath}`);
        }

        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Converte il foglio in JSON
        const rawData = XLSX.utils.sheet_to_json(worksheet);

        console.log(`✅ Trovate ${rawData.length} righe nel file Excel`);

        return rawData;
    } catch (error) {
        console.error('❌ Errore lettura file Excel:', error.message);
        process.exit(1);
    }
}

/**
 * Trasforma i dati Excel nel formato per Supabase
 */
function transformData(rawData) {
    console.log('🔄 Trasformazione dati...');

    const transformedData = rawData.map((row, index) => {
        try {
            // Estrai l'ID dal link se presente, altrimenti usa l'index
            let id = index + 1;
            if (row.ID && typeof row.ID === 'string' && row.ID.includes('[') && row.ID.includes(']')) {
                const match = row.ID.match(/\\[(\\d+)\\]/);
                if (match) {
                    id = parseInt(match[1]);
                }
            } else if (row.ID && typeof row.ID === 'number') {
                id = row.ID;
            }

            return {
                id: id,
                severity: row.Severity || 'Medium',
                owner: row.Owner || null,
                rfc_fix_3: row['RFC Fix 3'] || null,
                rfc_fix_2: row['RFC Fix 2'] || null,
                rfc_fix_1: row['RFC Fix 1'] || null,
                rfc: row.RFC || null,
                previsione_chiusura_defect: parseExcelDate(row['Previsione chiusura defect']),
                fix_date: parseExcelDate(row['Fix date']),
                name: row.Name || `Defect ${id}`,
                phase: row.Phase || 'New',
                team: row.Team || null,
                canale: row.Canale || null,
                application_modules: row['Application modules'] || null,
                creation_time: parseExcelDate(row['Creation time']) || new Date().toISOString(),
                feature: row.Feature || null
            };
        } catch (error) {
            console.warn(`⚠️  Errore processando riga ${index + 1}:`, error.message);
            return null;
        }
    }).filter(Boolean); // Rimuove le righe null

    console.log(`✅ Trasformate ${transformedData.length} righe valide`);
    return transformedData;
}

/**
 * Importa i dati in Supabase
 */
async function importToSupabase(data) {
    console.log(`🚀 Importazione di ${data.length} defect in Supabase...`);

    try {
        // Test connessione
        const { data: testData, error: testError } = await supabase
            .from('defects')
            .select('count')
            .limit(1);

        if (testError) {
            throw new Error(`Errore connessione Supabase: ${testError.message}`);
        }

        // Importa in batch per evitare timeout
        const batchSize = 100;
        let imported = 0;
        let errors = 0;

        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);

            console.log(`📦 Importazione batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)} (${batch.length} record)`);

            const { data: result, error } = await supabase
                .from('defects')
                .upsert(batch, {
                    onConflict: 'id',
                    ignoreDuplicates: false
                });

            if (error) {
                console.error(`❌ Errore batch ${Math.floor(i/batchSize) + 1}:`, error.message);
                errors += batch.length;
            } else {
                imported += batch.length;
                console.log(`✅ Batch importato con successo`);
            }
        }

        console.log(`\\n🎉 Importazione completata!`);
        console.log(`   ✅ Record importati: ${imported}`);
        console.log(`   ❌ Errori: ${errors}`);
        console.log(`   📊 Totale processati: ${data.length}`);

    } catch (error) {
        console.error('❌ Errore durante l\'importazione:', error.message);
        process.exit(1);
    }
}

/**
 * Funzione principale
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('🔧 Script di importazione defect da Excel a Supabase');
        console.log('');
        console.log('Utilizzo:');
        console.log('  node import-defects.js <percorso-file-excel>');
        console.log('');
        console.log('Esempio:');
        console.log('  node import-defects.js ./Octane_defects_filtered_19_09_2025_12_54_11.xlsx');
        console.log('');
        console.log('Prerequisiti:');
        console.log('  - npm install xlsx @supabase/supabase-js');
        console.log('  - export SUPABASE_SERVICE_KEY="your_service_key"');
        process.exit(1);
    }

    const filePath = path.resolve(args[0]);

    console.log('🚀 Avvio importazione defect');
    console.log(`📁 File: ${filePath}`);
    console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
    console.log('');

    // Step 1: Leggi il file Excel
    const rawData = readExcelFile(filePath);

    // Step 2: Trasforma i dati
    const transformedData = transformData(rawData);

    if (transformedData.length === 0) {
        console.error('❌ Nessun dato valido trovato nel file');
        process.exit(1);
    }

    // Step 3: Conferma dell'utente
    console.log('');
    console.log('📋 Anteprima primi 3 record:');
    transformedData.slice(0, 3).forEach((record, index) => {
        console.log(`\\n${index + 1}. ID: ${record.id}`);
        console.log(`   Nome: ${record.name}`);
        console.log(`   Severity: ${record.severity}`);
        console.log(`   Phase: ${record.phase}`);
        console.log(`   Owner: ${record.owner || 'N/A'}`);
        console.log(`   Team: ${record.team || 'N/A'}`);
    });

    // Step 4: Importa in Supabase
    await importToSupabase(transformedData);
}

// Gestione errori non catturati
process.on('unhandledRejection', (error) => {
    console.error('❌ Errore non gestito:', error.message);
    process.exit(1);
});

// Avvia lo script
main().catch(console.error);
