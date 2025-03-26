import { appBancaDir } from './constants';
import * as fs from 'fs';
import * as path from 'path';

// Percorso della directory
const baseDir = path.join(appBancaDir, 'assets/flutter_i18n/it');

// Controlla se la directory esiste
if (!fs.existsSync(baseDir)) {
    console.error(`❌ Errore: La directory ${baseDir} non esiste.`);
    process.exit(1);
}

// Recupera tutti i file JSON presenti nella directory
const jsonFiles = fs.readdirSync(baseDir).filter(file => file.endsWith('.json'));

if (jsonFiles.length === 0) {
    console.error(`❌ Errore: Nessun file JSON trovato in ${baseDir}.`);
    process.exit(1);
}

console.log(`\n📂 Elaborazione dei file JSON nella directory: ${baseDir}\n`);

// Funzione per elaborare un file JSON
const processJsonFile = (fileName: string) => {
    const filePath = path.join(baseDir, fileName);
    const sortedFilePath = path.join(baseDir, fileName.replace('.json', '_sorted.json'));
    const sortedCleanedFilePath = path.join(baseDir, fileName.replace('.json', '_sorted_cleaned.json'));

    // Lettura del file come testo senza alterare escape
    const rawData = fs.readFileSync(filePath, 'utf-8').trim();
    const cleanData = rawData.replace(/^\uFEFF/, ''); // Rimuove eventuali caratteri BOM

    // Parsing manuale per mantenere gli escape originali
    const entryRegex = /"([^"\\]+)":\s*"((?:[^"\\]|\\.)*)"/g;
    const entries: { key: string; value: string; raw: string }[] = [];

    let match;
    while ((match = entryRegex.exec(cleanData)) !== null) {
        entries.push({ key: match[1], value: match[2], raw: match[0] });
    }

    // Ordinamento delle chiavi
    entries.sort((a, b) => a.key.localeCompare(b.key));

    // Creazione del file ordinato
    const sortedJson = `{
${entries.map(e => `  ${e.raw}`).join(',\n')}
}`;
    fs.writeFileSync(sortedFilePath, sortedJson, 'utf-8');
    console.log(`✅ Creato file ordinato: ${sortedFilePath}`);

    // Identifica chiavi duplicate e mantiene la formattazione originale
    const groupedEntries = new Map<string, Set<string>>();
    const rawLines = new Map<string, Set<string>>();

    entries.forEach(({ key, value, raw }) => {
        if (!groupedEntries.has(key)) {
            groupedEntries.set(key, new Set());
            rawLines.set(key, new Set());
        }
        groupedEntries.get(key)!.add(value);
        rawLines.get(key)!.add(raw);
    });

    // Stampa chiavi con più di un valore
    const keysWithMultipleValues: string[] = [];
    groupedEntries.forEach((values, key) => {
        if (values.size > 1) {
            keysWithMultipleValues.push(key);
        }
    });

    if (keysWithMultipleValues.length > 0) {
        console.log(`⚠️ Chiavi con più di un valore nel file ${fileName}:`);
        keysWithMultipleValues.forEach(key => console.log(`  - ${key}`));
    } else {
        console.log(`✅ Nessuna chiave con più di un valore in ${fileName}`);
    }

    // Creazione del file pulito mantenendo il formato originale
    const cleanedEntries: string[] = [];
    groupedEntries.forEach((values, key) => {
        if (values.size === 1) {
            cleanedEntries.push([...rawLines.get(key)!][0]);
        } else {
            cleanedEntries.push(...rawLines.get(key)!);
        }
    });

    const cleanedJson = `{
${cleanedEntries.map(line => `  ${line}`).join(',\n')}
}`;
    fs.writeFileSync(sortedCleanedFilePath, cleanedJson, 'utf-8');
    console.log(`✅ Creato file pulito: ${sortedCleanedFilePath}`);
};

// Processa tutti i file JSON nella directory
jsonFiles.forEach(file => processJsonFile(file));

console.log(`\n🔍 Elaborazione completata per tutti i file JSON!\n`);
