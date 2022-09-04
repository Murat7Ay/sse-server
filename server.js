const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https');
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));

app.get('/status', (request, response) => response.json({
    clients: clients.length,
    details: clients.map(s => s.settings)
}));

const PORT = process.env.PORT || 3000;

let clients = [];

app.listen(PORT, () => {
    console.log(`Facts Events service listening at http://localhost:${PORT}`)
})

app.get('/events', eventsHandler);
function eventsHandler(request, response, next) {
    if (clients.length > 5) {
        response.writeHead(418, "Maximum client exceed");
        return;
    }
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    };
    let settings = {
        nickName: request.query.nickName,
        avatarNo: request.query.avatarNo,
        chatPassword: request.query.chatPassword
    };
    const clientId = request.query.id;

    response.writeHead(200, headers);
    if (clients.findIndex(x => x.id === clientId) < 0) {
        const newClient = {
            id: clientId,
            settings,
            response
        };

        clients.push(newClient);
    }

    request.on('close', () => {
        console.log(`${clientId} Connection closed`);
        clients = clients.filter(client => client.id !== clientId);
    });
}


app.post('/fact', addFact);
async function addFact(request, respsonse, next) {
    const newFact = request.body;
    console.log(newFact)
    respsonse.json(newFact)
    return sendEventsToAll(newFact);
}

function sendEventsToAll(newFact) {
    let message = newFact.message;
    const usersWithSamePassword = clients.filter(function (e) {
        return e.settings.chatPassword === newFact.settings.chatPassword;
    });
    var promise1 = translateRequest(message, 'tr-TR');
    var promise2 = translateRequest(message, 'en-US');
    var promise3 = translateRequest(message, 'ru-RU');
    Promise.all([promise1, promise2, promise3]).then((values) => {
        let translateObject = values.reduce((obj, item) => Object.assign(obj, { [item.targetLanguage]: item.translateText }), {});
        newFact.translateResult = translateObject;
        usersWithSamePassword.forEach(client => client.response.write(`data: ${JSON.stringify(newFact)}\n\n`));
    });
}



function translateRequest(message, tl) {
    return new Promise((resolve, reject) => {
        https.get('https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=' + tl + '&q=' + encodeURI(message), (response) => {
            let chunks_of_data = [];
            response.on('data', (fragments) => {
                chunks_of_data.push(fragments);
            });
            response.on('end', () => {
                let response_body = Buffer.concat(chunks_of_data);
                let response_body_json = JSON.parse(response_body.toString());
                let translateText = response_body_json[0][0];
                let targetLanguage = tl;
                resolve({ translateText, targetLanguage });
            });
            response.on('error', (error) => {
                reject(error);
            });
        });
    });
}
