import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { appBancaDir } from './constants';

// Percorsi delle directory
const dir1: string = path.join(appBancaDir, 'assets/flutter_i18n/it');
const dir2: string = path.join(appBancaDir, 'bridge/assets/flutter_i18n/it');

// Simboli Unicode per la leggibilità
const CHECK = '✅';  // Verde - tutto ok
const CROSS = '❌';  // Rosso - errore
const WARNING = '⚠️'; // Giallo - avviso
const DOT = '🔹';  // Punto elenco per file

// Funzione per ottenere l'hash di un file
const getFileHash = (filePath: string): string => {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
};

// Funzione per ottenere una lista ricorsiva dei file in una directory
const getAllFiles = (dir: string): string[] => {
    let files: string[] = [];
    fs.readdirSync(dir).forEach((file: string) => {
        const filePath: string = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            files = files.concat(getAllFiles(filePath));
        } else {
            files.push(filePath);
        }
    });
    return files;
};

// Recupera tutti i file JSON presenti nella directory principale
type FileCheckResult = { file: string, keysWithMultipleValues: string[] };
const checkJsonFiles = (baseDir: string): FileCheckResult[] => {
    const jsonFiles = fs.readdirSync(baseDir).filter(file => file.endsWith('.json'));
    if (jsonFiles.length === 0) {
        console.error(`${CROSS} Errore: Nessun file JSON trovato in ${baseDir}.`);
        process.exit(1);
    }

    return jsonFiles.map(file => {
        const filePath = path.join(baseDir, file);
        const rawData = fs.readFileSync(filePath, 'utf-8').trim().replace(/^﻿/, '');
        const entryRegex = /"([^"\\]+)":\s*"((?:[^"\\]|\\.)*)"/g;
        const entries: { key: string; value: string }[] = [];

        let match;
        while ((match = entryRegex.exec(rawData)) !== null) {
            entries.push({ key: match[1], value: match[2] });
        }

        const groupedEntries = new Map<string, Set<string>>();
        entries.forEach(({ key, value }) => {
            if (!groupedEntries.has(key)) {
                groupedEntries.set(key, new Set());
            }
            groupedEntries.get(key)!.add(value);
        });

        const keysWithMultipleValues: string[] = [];
        groupedEntries.forEach((values, key) => {
            if (values.size > 1) {
                keysWithMultipleValues.push(key);
            }
        });

        return { file, keysWithMultipleValues };
    });
};

// Esegue il controllo JSON sulla directory principale
console.log(`\n📂 (1/2) Verifica delle chiavi presenti nei file JSON i18n della directory assets\n`);
const jsonCheckResults = checkJsonFiles(dir1);
jsonCheckResults.forEach(({ file, keysWithMultipleValues }) => {
    console.log(`\n📂 Verifica file: ${file}`);
    if (keysWithMultipleValues.length > 0) {
        console.log(`${WARNING} Chiavi con più di un valore:`);
        keysWithMultipleValues.forEach(key => console.log(`   - ${key}`));
    } else {
        console.log(`${CHECK} Nessuna chiave con più di un valore`);
    }
});

// Esegue il confronto tra le directory
console.log(`\n📂 (2/2) Verifica dei file JSON i18n tra le directory assets e bridge/assets\n`);
const files1: string[] = getAllFiles(dir1).map((file: string) => path.relative(dir1, file));
const files2: string[] = getAllFiles(dir2).map((file: string) => path.relative(dir2, file));
const onlyInDir1: string[] = files1.filter(file => !files2.includes(file));
const onlyInDir2: string[] = files2.filter(file => !files1.includes(file));
const commonFiles: string[] = files1.filter(file => files2.includes(file));
const differentContentFiles: string[] = commonFiles.filter(file => {
    return getFileHash(path.join(dir1, file)) !== getFileHash(path.join(dir2, file));
});

if (onlyInDir1.length > 0) {
    console.log(`${CROSS} File presenti solo in ${dir1}:`);
    onlyInDir1.forEach(file => console.log(`  ${DOT} ${file}`));
} else {
    console.log(`${CHECK} Nessun file mancante in ${dir1}`);
}

if (onlyInDir2.length > 0) {
    console.log(`${CROSS} File presenti solo in ${dir2}:`);
    onlyInDir2.forEach(file => console.log(`  ${DOT} ${file}`));
} else {
    console.log(`${CHECK} Nessun file mancante in ${dir2}`);
}

if (differentContentFiles.length > 0) {
    console.log(`${WARNING} File JSON con contenuto diverso:`);
    differentContentFiles.forEach(file => console.log(`  ${DOT} ${file}`));
} else {
    console.log(`${CHECK} Nessuna differenza nei contenuti dei file comuni.`);
}

console.log(`\n🔍 Verifica completata!\n`);
