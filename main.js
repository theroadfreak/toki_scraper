require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");
const crypto = require("crypto");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");

// init telegram
const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });
let GroupID = process.env.GROUPID;
let sites = [
  "https://www.esgct.eu/News-and-Events/News.aspx",
  "https://www.esgct.eu/Networking-and-community/Latest-news.aspx",
];

/*    TELEGRAM     */

// setup telegram
bot.on("polling_error", console.log);

// start message (setup)
bot.onText(/\/start/, (msg, match) => {
  setup(msg);
});

async function setup(msg) {
  // creo un oggetto contenente i vari hash
  let obj = { hash: [] };
  for (let i = 0; i < sites.length; i++) {
    let tmphash = await scrapeData(sites[i]);
    obj.hash.push(tmphash);
  }
  // scrivo nel database gli hash
  writeData(obj);

  /* 
        Per scoprire il proprio chat id (o quello del gruppo)
        basta decommentare le due righe sotto 
    */
  // GroupID = msg.chat.id;
  // bot.sendMessage(GroupID, "Il tuo id è: "+GroupID);
  bot.sendMessage(GroupID, "Bot online");
}

function scrivi(stringa) {
  bot.sendMessage(GroupID, stringa);
}

/*------------------------------------------------------------------*/

/*    SCRAPING     */

// funzione di scraping vera e propria
async function scrapeData(url) {
  try {
    // prendo l'html del sito e lo "carico" in una variabile per i prossimi passaggi
    // NB: guardare
    let { data } = await axios.get(url);
    const $ = cheerio.load(data);
    let lista = "";
    // cerca l'elemento dell'html chiamato "menu" e agisce su ogni elemento della lista
    $(".menu")
      .find("li")
      .each((i, elem) => {
        try {
          // aggiungo sia il titolo che la scritta per ogni punto della lista
          // NB: si possono aggiungere altre stringhe di altri elementi per tenerli sott'occhio
          lista += $(elem).find("h4").text();
          lista += $(elem).find("p").text();
          lista += $(elem).find("a").attr("href");
          // ovviamente si possono anche togliere se non si è interessati a cambiamenti poco
          // significativi come il cambiamento del nome di un link (lista += $(elem).find('h4').text();)
        } catch (err) {
          // togliere se si vogliono non gestire gli errori
          console.log(err);
        }
      });

    // creazione hash
    let hash = crypto.createHash("sha256").update(lista).digest("hex");
    return hash;
  } catch (err) {
    console.log(err);
    return -1;
  }
}

/*------------------------------------------------------------------*/

/*    DATABASE HASH     */

function readData() {
  const data = fs.readFileSync("db.json", "utf8");
  return JSON.parse(data);
}

function writeData(obj) {
  if (!obj) {
    return;
  }
  try {
    fs.writeFileSync("db.json", JSON.stringify(obj));
    console.log("overwrite");
  } catch (err) {
    console.log("errore", err);
  }
}

/*------------------------------------------------------------------*/

/*    ESECUZIONE     */

// esegue le azioni ciclicamente con un certo intervallo in ms
setInterval(async () => {
  let obj = readData();
  const hash_db = obj.hash;
  let someUpdate = false;

  for (let i in sites) {
    let hash = await scrapeData(sites[i]);
    console.log(hash);
    if (hash != hash_db[i]) {
      obj.hash[i] = hash;
      scrivi("update " + sites[i]);
      someUpdate = true;
    }
  }
  // se ci sono update aggiorna il database
  if (someUpdate) {
    writeData(obj);
  }
}, 500_000); // guarda per gli aggiornamenti ogni 500.000 ms
