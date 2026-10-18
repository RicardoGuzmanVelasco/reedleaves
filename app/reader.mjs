import { startReader } from "./reader-app.mjs?v=practice-topic-decks-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
