import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();
import fetch from 'node-fetch';

const REGION = 'asia-northeast1';

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
    return await fetch("https://cors-anywhere.herokuapp.com/https://api.itsukaralink.jp/events.json")
        .then(res => res.json());
}


export const crawlEvents = functions
    .region(REGION)
    .https.onRequest(async (req, res) => {
        const events = await fetchEvents()
        if (events.status === "ng") return;

        const db = admin.firestore();
        const batch = db.batch();
        events.data.events.forEach(evt => {
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
            .then(_ => {
                console.log("Transaction successfully committed!");
            })
            .catch(function(error) {
                console.log("Transaction failed: ", error);
            });
    });