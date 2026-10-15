import { startReader } from "./reader-app.mjs?v=library-note-nudge-primary";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
