import "./styles.css";
import { mountGame } from "./ui/game";

const app = document.querySelector<HTMLDivElement>("#app")!;
mountGame(app);
