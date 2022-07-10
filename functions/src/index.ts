import * as functions from "firebase-functions";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import fetch from "cross-fetch";

const REGION = "asia-northeast1";
const SCHEDULE = "0 */4 * * *";
const TIME_ZONE = "Asia/Tokyo";
const URL = "https://api.itsukaralink.jp/events.json";

functions.logger.info("initialize");
initializeApp();

interface Liver {
    id: number;
    name: string;
    avatar: string;
    color: string;
}

interface Genre {
    id: number;
    name: string;
}

interface Event {
    id: number;
    name: string;
    description: string;
    public: number;
    url: string;
    thumbnail: string;
    start_date: Date;
    end_date: Date;
    recommend: boolean;
    genre: Genre | null;
    liver: Liver;
}

interface Data {
    events: Event[];
}

interface EventsResponse {
    status: "ok" | "ng";
    data: Data;
}


const fetchEvents = async (): Promise<EventsResponse|null> => {
  functions.logger.info("#fetchEvents", {url: URL});

  try {
    const response = await fetch(URL);
    return await response.json() as EventsResponse;
  } catch (err) {
    functions.logger.error("#fetchEvents", err);
    return null;
  }
};

type DB = FirebaseFirestore.Firestore;
const writeEventToFirestore = async (events: Event[], db: DB) => {
  const counts = events.length;

  functions.logger.info("#writeEventToFirestore", {counts});
  if (counts === 0) {
    return;
  }

  const batch = db.batch();

  for (const event of events) {
    const param = {
      "id": event.id,
      "name": event.name,
      "description": event.description,
      "public": event.public,
      "url": event.url,
      "thumbnail": event.thumbnail,
      "start_date": event.start_date,
      "end_date": event.end_date,
      "recommend": event.recommend,
      "genre_id": event.genre?.id || -1,
      "liver": {
        "id": event.liver.id,
        "name": event.liver.name,
      },
    };

    functions.logger.info("#writeEventToFirestore.Set", param);
    batch.set(
        db.collection("/events").doc(event.id.toString()),
        param
    );
  }

  try {
    await batch.commit();
  } catch (err) {
    functions.logger.error("#writeEventToFirestore", err);
  }
};

const crawlItsukaralinkEventsHandler = async () => {
  const apiResponse = await fetchEvents();
  if (apiResponse === null) {
    return;
  }
  if (apiResponse.status === "ng") {
    functions.logger.error("#crawlEventsHandler: status is ng");
  }

  const db = getFirestore();
  await writeEventToFirestore(apiResponse.data.events, db);
};

export const crawlItsukaralinkEvents = functions
    .region(REGION)
    .pubsub
    .schedule(SCHEDULE)
    .timeZone(TIME_ZONE)
    .onRun(crawlItsukaralinkEventsHandler);

