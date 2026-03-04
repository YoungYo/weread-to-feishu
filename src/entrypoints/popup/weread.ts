import type { BookBrief, WereadNotebookResponse } from "./types";

export async function fetchNotebookBooks(): Promise<BookBrief[]> {
  const response = await fetch("https://weread.qq.com/api/user/notebook", {
    method: "GET",
    credentials: "include",
  });

  const data = (await response.json()) as WereadNotebookResponse;
  const errCode = data?.data?.errcode;

  if (errCode) {
    if (errCode === -2010 || errCode === -2012) {
      throw new Error("NOT_LOGIN");
    }
    throw new Error(`FAILED_TO_FETCH_BOOKS_${errCode}`);
  }

  const books = data.books?.map((item) => item.book).filter(Boolean) as BookBrief[];
  return books;
}

export async function fetchBookMarkdown(bookId: string, userVid: string): Promise<string> {
  const [markData, reviewData, progressData] = await Promise.all([
    fetch(`https://weread.qq.com/web/book/bookmarklist?bookId=${bookId}`, {
      credentials: "include",
    }).then((r) => r.json()),
    fetch(
      `https://weread.qq.com/web/review/list?bookId=${bookId}&mine=1&listType=11&maxIdx=0&count=0&listMode=2&synckey=0&userVid=${userVid}`,
      {
        credentials: "include",
      },
    ).then((r) => r.json()),
    fetch(`https://weread.qq.com/web/book/getProgress?bookId=${bookId}`, {
      credentials: "include",
    }).then((r) => r.json()),
  ]);

  const title = markData?.book?.title ?? "未知书名";
  const author = markData?.book?.author ?? "未知作者";
  const chapters: Array<{ chapterUid?: string; title?: string; chapterIdx?: number }> = markData?.chapters ?? [];
  const markList: Array<{
    chapterUid?: string;
    type?: number;
    markText?: string;
    range?: string;
    chapterTitle?: string;
  }> = markData?.updated ?? [];
  const reviewList: Array<{
    review?: {
      chapterUid?: string;
      type?: number;
      range?: string;
      content?: string;
      abstract?: string;
      chapterTitle?: string;
    };
  }> = reviewData?.reviews ?? [];

  const chapterTitleMap = new Map<string, string>();
  chapters.forEach((ch) => {
    if (ch.chapterUid) {
      chapterTitleMap.set(ch.chapterUid, ch.title ?? `章节 ${ch.chapterIdx ?? ""}`.trim());
    }
  });

  type MarkItem = {
    range: string;
    markText: string;
    reviewText: string;
  };

  const grouped = new Map<string, MarkItem[]>();
  for (const mark of markList) {
    if (mark.type !== 1 || !mark.chapterUid) continue;
    const list = grouped.get(mark.chapterUid) ?? [];
    list.push({
      range: mark.range ?? "",
      markText: mark.markText ?? "",
      reviewText: "",
    });
    grouped.set(mark.chapterUid, list);
  }

  for (const reviewWrap of reviewList) {
    const review = reviewWrap.review;
    if (!review || review.type !== 1 || !review.chapterUid) continue;
    const list = grouped.get(review.chapterUid) ?? [];
    const existing = list.find((item) => item.range === (review.range ?? ""));
    if (existing) {
      existing.reviewText = review.content ?? "";
    } else {
      list.push({
        range: review.range ?? "",
        markText: review.abstract ?? "",
        reviewText: review.content ?? "",
      });
    }
    grouped.set(review.chapterUid, list);
  }

  const reading = progressData?.book;
  const startText = reading?.startReadingTime
    ? new Date(reading.startReadingTime * 1000).toLocaleString()
    : "未知";
  const finishText = reading?.finishTime
    ? new Date(reading.finishTime * 1000).toLocaleString()
    : "未知";
  const readHours = reading?.readingTime ? Math.floor(reading.readingTime / 3600) : 0;

  const totalNotes = Array.from(grouped.values()).reduce((acc, list) => acc + list.length, 0);

  let md = `# ${title}\n\n`;
  md += `- 作者：${author}\n`;
  md += `- 笔记数量：${totalNotes}\n`;
  md += `- 阅读时长：${readHours} 小时\n`;
  md += `- 开始时间：${startText}\n`;
  md += `- 结束时间：${finishText}\n\n`;
  md += `---\n\n`;

  for (const chapter of chapters.sort((a, b) => (a.chapterIdx ?? 0) - (b.chapterIdx ?? 0))) {
    const chapterUid = chapter.chapterUid;
    if (!chapterUid) continue;
    const notes = grouped.get(chapterUid) ?? [];
    if (!notes.length) continue;

    notes.sort((a, b) => {
      const left = Number((a.range || "0").split("-")[0]);
      const right = Number((b.range || "0").split("-")[0]);
      return left - right;
    });

    md += `## ${chapterTitleMap.get(chapterUid) ?? chapter.title ?? "未命名章节"}\n\n`;
    for (const note of notes) {
      if (note.reviewText.trim()) {
        md += `${note.reviewText.trim()}\n\n`;
      }
      if (note.markText.trim()) {
        md += `> ${note.markText.trim()}\n\n`;
      }
      md += `---\n\n`;
    }
  }

  return md;
}
