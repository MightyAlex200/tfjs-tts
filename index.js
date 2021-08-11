tf.enableProdMode()

const text2mel = tf.loadGraphModel('text2meljstiny/model.json');
const vocoder = tf.loadGraphModel('vocoderjstiny/model.json');

const audioContext = new AudioContext();
async function playAudio(wav) {
    const buf = audioContext.createBuffer(1, wav.shape[1], 22050);
    buf.copyToChannel(await wav.data(), 0);
    var source = audioContext.createBufferSource();
    source.buffer = buf;
    source.connect(audioContext.destination);
    source.start();
}

const symbols = ['pad',
    '-',
    '!',
    "'",
    '(',
    ')',
    ',',
    '.',
    ':',
    ';',
    '?',
    ' ',
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
    'u',
    'v',
    'w',
    'x',
    'y',
    'z',
    '@AA',
    '@AA0',
    '@AA1',
    '@AA2',
    '@AE',
    '@AE0',
    '@AE1',
    '@AE2',
    '@AH',
    '@AH0',
    '@AH1',
    '@AH2',
    '@AO',
    '@AO0',
    '@AO1',
    '@AO2',
    '@AW',
    '@AW0',
    '@AW1',
    '@AW2',
    '@AY',
    '@AY0',
    '@AY1',
    '@AY2',
    '@B',
    '@CH',
    '@D',
    '@DH',
    '@EH',
    '@EH0',
    '@EH1',
    '@EH2',
    '@ER',
    '@ER0',
    '@ER1',
    '@ER2',
    '@EY',
    '@EY0',
    '@EY1',
    '@EY2',
    '@F',
    '@G',
    '@HH',
    '@IH',
    '@IH0',
    '@IH1',
    '@IH2',
    '@IY',
    '@IY0',
    '@IY1',
    '@IY2',
    '@JH',
    '@K',
    '@L',
    '@M',
    '@N',
    '@NG',
    '@OW',
    '@OW0',
    '@OW1',
    '@OW2',
    '@OY',
    '@OY0',
    '@OY1',
    '@OY2',
    '@P',
    '@R',
    '@S',
    '@SH',
    '@T',
    '@TH',
    '@UH',
    '@UH0',
    '@UH1',
    '@UH2',
    '@UW',
    '@UW0',
    '@UW1',
    '@UW2',
    '@V',
    '@W',
    '@Y',
    '@Z',
    '@ZH',
    'eos'];

function symbolId(symbol) {
    return symbols.indexOf(symbol);
}

const curly_re = /(.*?)\{(.+?)\}(.*)/;

function convertText(text) {
    let sequence = [];
    while (text.length != 0) {
        let m = text.match(curly_re);
        if (m == null) {
            sequence = sequence.concat(convertSymbols(cleanText(text)));
            break;
        }
        sequence = sequence.concat(convertSymbols(cleanText(m[1])));
        sequence = sequence.concat(convertArpabet(m[2]));
        text = m[3];
    }

    sequence = sequence.concat(symbolId("eos"));
    return sequence;
}

function convertSymbols(text) {
    if (typeof text == 'string') {
        text = text.split('');
    }
    return text.filter(keepSymbol).map(symbolId);
}

function convertArpabet(text) {
    return convertSymbols(text.split(/\s+/).map(char => "@" + char));
}

function keepSymbol(symbol) {
    return symbols.indexOf(symbol) != -1 && symbol != "_" && symbol != "~";
}

function cleanText(text) {
    text = transliterate(text);
    text = text.toLowerCase();
    text = expandNumbers(text);
    text = expandAbbreviations(text);
    text = collapseWhitespace(text);
    return text;
}

function collapseWhitespace(text) {
    text.replace(/\s+/, " ");
    return text;
}

const abbreviations = {
    "mrs": "misess",
    "mr": "mister",
    "dr": "doctor",
    "st": "saint",
    "co": "company",
    "jr": "junior",
    "maj": "major",
    "gen": "general",
    "drs": "doctors",
    "rev": "reverend",
    "lt": "lieutenant",
    "hon": "honorable",
    "sgt": "sergeant",
    "capt": "captain",
    "esq": "esquire",
    "ltd": "limited",
    "col": "colonel",
    "ft": "fort",
};

function expandAbbreviations(text) {
    for (const key of Object.keys(abbreviations)) {
        const val = abbreviations[key];
        text = text.replace(key, val);
    }
    return text;
}

const comma_number_re = /([0-9][0-9\,]+[0-9])/;
const decimal_number_re = /([0-9]+\.[0-9]+)/;
const dollars_re = /\$([0-9\.\,]*[0-9]+)/;
const ordinal_re = /[0-9]+(st|nd|rd|th)/;
const number_re = /[0-9]+/;

function expandNumbers(text) {
    text = text.replace(comma_number_re, remove_commas);
    text = text.replace(dollars_re, expand_dollars);
    text = text.replace(decimal_number_re, expand_decimal_point);
    text = text.replace(ordinal_re, expand_ordinal);
    text = text.replace(number_re, expand_number);
    return text;
}

function remove_commas(match, group) {
    return group.replace(",", "");
}


function expand_decimal_point(match, group) {
    return group.replace(".", " point ");
}


function expand_dollars(_, match) {
    const parts = match.split(".");
    if (parts.length > 2)
        return match + " dollars"  // Unexpected format
    const dollars = parts[0] ? parseInt(parts[0]) : 0;
    const cents = parts[1] ? parseInt(parts[1]) : 0;
    const dollar_unit = dollars == 1 ? "dollar" : "dollars";
    const cent_unit = cents == 1 ? "cent" : "cents";
    if (dollars && cents) {
        return `${dollars} ${dollar_unit}, ${cents} ${cent_unit}`;
    } else if (dollars) {
        return `${dollars} ${dollar_unit}`;
    } else if (cents) {
        return `${cents} ${cent_unit}`;
    } else {
        return "zero dollars";
    }
}

function expand_ordinal(match) {
    return numberToWords.toWordsOrdinal(match);
}


function expand_number(match) {
    const num = parseInt(match);
    return numberToWords.toWords(num);
}

async function tts(text, ttsStatus) {
    ttsStatus.innerText = "Converting input";
    const input_ids = tf.tensor([convertText(text)], null, 'int32');
    inputs = {
        "input_ids": input_ids,
        "speaker_ids": tf.tensor([0], null, 'int32'),
        "speed_ratios:0": tf.tensor([1.0], null, 'float32'),
        "f0_ratios": tf.tensor([1.0], null, 'float32'),
        "energy_ratios": tf.tensor([1.0], null, 'float32'),
    };
    ttsStatus.innerText = "Generating mel spectrogram (be patient)";
    console.time("inference");
    console.time("mel generation");
    const mel = await (await text2mel).executeAsync(inputs);
    console.timeEnd("mel generation");
    console.time("vocoding");
    ttsStatus.innerText = "Generating waveform (be patient)";
    const wav = (await vocoder).execute(mel[0]);
    console.timeEnd("vocoding");
    console.timeEnd("inference");
    ttsStatus.innerText = "Done!";
    playAudio(wav);
    for (let i = 0; i < inputs.length; i++) {
        inputs[i].dispose();
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const ttsInput = document.getElementById("tts-input");
    const ttsStart = document.getElementById("tts-start");
    const ttsStatus = document.getElementById("tts-status");
    ttsStart.addEventListener("click", async function () {
        await tts(ttsInput.value, ttsStatus);
    });
});