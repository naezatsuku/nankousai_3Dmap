export interface Exhibit {
  id: string; // 3桁の数字 (例: "201")
  name: string;
  waitMinutes: number;
  thumbnail_url: string;
}

export const ROOM_DATA: Record<string, Exhibit> = {
  "102": { id: "102", name: "1-2 迷路", waitMinutes: 15, thumbnail_url: "https://picsum.photos/100?sig=1" },
  "201": { id: "201", name: "2-1 カフェ", waitMinutes: 40, thumbnail_url: "https://picsum.photos/100?sig=2" },
  "301": { id: "301", name: "3-1 演劇", waitMinutes: 0, thumbnail_url: "https://picsum.photos/100?sig=3" },
};