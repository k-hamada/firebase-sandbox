import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();
import fetch from 'node-fetch';

interface Liver {
    id: number;
    name: string;
    avatar: string;
    color: string;
}

interface Event {
    id: number;
    name: string;
    description: string;
    public: number;
    url: string;
    start_date: Date;
    end_date: Date;
    recommend: boolean;
    liver: Liver;
}

interface Data {
    events: Event[];
}

interface EventsResponse {
    status: "ok" | "ng";
    data: Data;
}

const fetchEvents = async (): Promise<EventsResponse> => {
    const cors = "https://cors-anywhere.herokuapp.com/";
    const url = "https://api.itsukaralink.jp/events.json";
    const requestInit = { headers: { "origin": "" } };

    return await fetch(cors + url, requestInit)
        .then(res => res.json())
        .catch(err => console.error(err));
}

const REGION = 'asia-northeast1';

export const crawlEvents = functions
    .region(REGION)
    .https.onRequest(async (req, res) => {
        const cronPassword = req.get('X-CRON-PASSWORD');
        if (cronPassword !== functions.config().api.key) {
            console.error(cronPassword);

            res.status(403).send(cronPassword);
            return;
        }

        const events = await fetchEvents()
        if (events.status === "ng") {
            console.error(events);

            res.status(500).send(events.status);
            return;
        }

        const db = admin.firestore();
        const batch = db.batch();

        const counts = events.data.events.length;
        console.info(`Commit ${counts} events`)

        events.data.events.forEach(evt => {
            console.info(`Set ${evt.id}: ${evt.name}`)

            batch.set(
                db.collection("/events").doc(`${evt.id}`),
                {
                    "id" : evt.id,
                    "name": evt.name,
                    "description": evt.description,
                    "url": evt.url,
                    "start_date": evt.start_date,
                    "end_date": evt.end_date,
                    "liver": {
                        "id": evt.liver.id,
                        "name": evt.liver.name,
                    }
                }
            );
        });

        batch.commit()
            .then(_ => res.status(200).send(`${events.status}\n${counts}`))
            .catch(err => console.error(err));
    });