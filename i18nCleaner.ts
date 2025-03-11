import { appBancaDir } from './constants';
import * as fs from 'fs';
import * as path from 'path';

// Percorsi dei file
const baseDir = path.join(appBancaDir, 'assets/flutter_i18n');
const inputFile = path.join(baseDir, 'it.json');
const sortedFile = path.join(baseDir, 'it_sorted.json');
const sortedCleanedFile = path.join(baseDir, 'it_sorted_cleaned.json');

// Controlla se il file di input esiste
if (!fs.existsSync(inputFile)) {
    console.error(`❌ Errore: Il file ${inputFile} non esiste.`);
    process.exit(1);
}

// **1️⃣ Lettura del file come testo senza alterare escape**
const rawData = fs.readFileSync(inputFile, 'utf-8').trim();
const cleanData = rawData.replace(/^\uFEFF/, ''); // Rimuove eventuali caratteri BOM

// **2️⃣ Parsing manuale per mantenere gli escape originali**
const entryRegex = /"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/g;
const entries: { key: string; value: string; raw: string }[] = [];

let match;
while ((match = entryRegex.exec(cleanData)) !== null) {
    entries.push({ key: match[1], value: match[2], raw: match[0] });
}

// **3️⃣ Creazione di it_sorted.json (senza modificare il formato originale)**
entries.sort((a, b) => a.key.localeCompare(b.key));

const sortedJson = `{\n${entries.map(e => `  ${e.raw}`).join(',\n')}\n}`;
fs.writeFileSync(sortedFile, sortedJson, 'utf-8');
console.log(`✅ Creato file ordinato: ${sortedFile} (righe: ${entries.length})`);

// **4️⃣ Creazione di it_sorted_cleaned.json mantenendo il formato originale**
const groupedEntries = new Map<string, Set<string>>();
const rawLines = new Map<string, Set<string>>(); // Mappa per mantenere il formato originale

entries.forEach(({ key, value, raw }) => {
    if (!groupedEntries.has(key)) {
        groupedEntries.set(key, new Set());
        rawLines.set(key, new Set());
    }
    groupedEntries.get(key)!.add(value);
    rawLines.get(key)!.add(raw); // Mantiene la formattazione originale della riga
});

// **5️⃣ Stampa in colonna delle chiavi con più di un valore**
const keysWithMultipleValues: string[] = [];
groupedEntries.forEach((values, key) => {
    if (values.size > 1) {
        keysWithMultipleValues.push(key);
    }
});

if (keysWithMultipleValues.length > 0) {
    console.log(`\n⚠️ Chiavi con più di un valore:`);
    keysWithMultipleValues.forEach(key => console.log(`  - ${key}`));
} else {
    console.log(`\n✅ Nessuna chiave con più di un valore`);
}

// **6️⃣ Scrittura del file it_sorted_cleaned.json**
const cleanedEntries: string[] = [];
groupedEntries.forEach((values, key) => {
    if (values.size === 1) {
        // Se la chiave ha un solo valore, manteniamo la riga originale
        cleanedEntries.push([...rawLines.get(key)!][0]);
    } else {
        // Se la chiave ha più valori diversi, li scriviamo tutti
        cleanedEntries.push(...rawLines.get(key)!);
    }
});

const cleanedJson = `{\n${cleanedEntries.map(line => `  ${line}`).join(',\n')}\n}`;
fs.writeFileSync(sortedCleanedFile, cleanedJson, 'utf-8');

console.log(`✅ Creato file pulito con chiavi duplicate mantenute: ${sortedCleanedFile} (righe: ${cleanedEntries.length})`);
