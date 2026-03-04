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

function normalizeChapterUid(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const key = String(value).trim();
  return key ? key : null;
}

function parseRangeStart(range: string): number {
  const start = Number(range.split("-")[0]);
  return Number.isFinite(start) ? start : Number.MAX_SAFE_INTEGER;
}

function normalizeUnixSeconds(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return Number.MAX_SAFE_INTEGER;
  }
  return num > 1_000_000_000_000 ? Math.floor(num / 1000) : Math.floor(num);
}

function formatUnixTime(value: unknown): string {
  const seconds = normalizeUnixSeconds(value);
  if (seconds === Number.MAX_SAFE_INTEGER) {
    return "未知";
  }
  return new Date(seconds * 1000).toLocaleString();
}

function toBlockQuote(text: string): string {
  return text
    .split("\n")
    .map((line) => `> ${line.trimEnd()}`)
    .join("\n");
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
  const chapters: Array<{ chapterUid?: string | number; title?: string; chapterIdx?: number }> = markData?.chapters ?? [];
  const markList: Array<{
    chapterUid?: string | number;
    type?: number | string;
    markText?: string;
    range?: string;
    chapterTitle?: string;
    createTime?: number | string;
  }> = markData?.updated ?? [];
  const reviewList: Array<{
    review?: {
      chapterUid?: string | number;
      type?: number | string;
      range?: string;
      content?: string;
      abstract?: string;
      chapterTitle?: string;
      chapterIdx?: number;
      createTime?: number | string;
    };
  }> = reviewData?.reviews ?? [];

  type ChapterMeta = {
    title: string;
    chapterIdx: number;
  };

  type NoteItem = {
    kind: "highlight" | "comment";
    range: string;
    text: string;
    abstract?: string;
    createdAtText: string;
    createdAtOrder: number;
  };

  const chapterMetaMap = new Map<string, ChapterMeta>();
  for (const chapter of chapters) {
    const key = normalizeChapterUid(chapter.chapterUid);
    if (!key) continue;

    chapterMetaMap.set(key, {
      title: chapter.title ?? `章节 ${chapter.chapterIdx ?? key}`,
      chapterIdx: chapter.chapterIdx ?? Number.MAX_SAFE_INTEGER,
    });
  }

  const grouped = new Map<string, NoteItem[]>();

  for (const mark of markList) {
    const chapterKey = normalizeChapterUid(mark.chapterUid);
    if (Number(mark.type) !== 1 || !chapterKey) continue;

    const markText = (mark.markText ?? "").trim();
    if (!markText) continue;

    const list = grouped.get(chapterKey) ?? [];
    list.push({
      kind: "highlight",
      range: mark.range ?? "",
      text: markText,
      createdAtText: formatUnixTime(mark.createTime),
      createdAtOrder: normalizeUnixSeconds(mark.createTime),
    });
    grouped.set(chapterKey, list);

    if (!chapterMetaMap.has(chapterKey)) {
      chapterMetaMap.set(chapterKey, {
        title: mark.chapterTitle ?? `章节 ${chapterKey}`,
        chapterIdx: Number.MAX_SAFE_INTEGER,
      });
    }
  }

  for (const reviewWrap of reviewList) {
    const review = reviewWrap.review;
    const chapterKey = normalizeChapterUid(review?.chapterUid);
    if (!review || Number(review.type) !== 1 || !chapterKey) continue;

    const commentText = (review.content ?? "").trim();
    if (!commentText) continue;

    const list = grouped.get(chapterKey) ?? [];
    list.push({
      kind: "comment",
      range: review.range ?? "",
      text: commentText,
      abstract: (review.abstract ?? "").trim(),
      createdAtText: formatUnixTime(review.createTime),
      createdAtOrder: normalizeUnixSeconds(review.createTime),
    });
    grouped.set(chapterKey, list);

    if (!chapterMetaMap.has(chapterKey)) {
      chapterMetaMap.set(chapterKey, {
        title: review.chapterTitle ?? `章节 ${chapterKey}`,
        chapterIdx: review.chapterIdx ?? Number.MAX_SAFE_INTEGER,
      });
    }
  }

  const reading = progressData?.book;
  const startText = reading?.startReadingTime ? formatUnixTime(reading.startReadingTime) : "未知";
  const finishText = reading?.finishTime ? formatUnixTime(reading.finishTime) : "未知";
  const readHours = reading?.readingTime ? Math.floor(reading.readingTime / 3600) : 0;

  const allNotes = Array.from(grouped.values()).flat();
  const highlightCount = allNotes.filter((item) => item.kind === "highlight").length;
  const commentCount = allNotes.filter((item) => item.kind === "comment").length;
  const totalNotes = allNotes.length;

  let md = `# ${title}\n\n`;
  md += `- 作者：${author}\n`;
  md += `- 笔记总数：${totalNotes}\n`;
  md += `- 划线数量：${highlightCount}\n`;
  md += `- 评论数量：${commentCount}\n`;
  md += `- 阅读时长：${readHours} 小时\n`;
  md += `- 开始时间：${startText}\n`;
  md += `- 结束时间：${finishText}\n\n`;
  md += `---\n\n`;

  const orderedChapterKeys = Array.from(grouped.keys()).sort((leftKey, rightKey) => {
    const leftMeta = chapterMetaMap.get(leftKey);
    const rightMeta = chapterMetaMap.get(rightKey);
    const leftIdx = leftMeta?.chapterIdx ?? Number.MAX_SAFE_INTEGER;
    const rightIdx = rightMeta?.chapterIdx ?? Number.MAX_SAFE_INTEGER;

    if (leftIdx !== rightIdx) {
      return leftIdx - rightIdx;
    }

    return leftKey.localeCompare(rightKey, "zh-CN", { numeric: true });
  });

  for (const chapterKey of orderedChapterKeys) {
    const notes = grouped.get(chapterKey) ?? [];
    if (!notes.length) continue;

    notes.sort((left, right) => {
      const byRange = parseRangeStart(left.range) - parseRangeStart(right.range);
      if (byRange !== 0) {
        return byRange;
      }
      return left.createdAtOrder - right.createdAtOrder;
    });

    const chapterTitle = chapterMetaMap.get(chapterKey)?.title ?? `章节 ${chapterKey}`;
    md += `## ${chapterTitle}\n\n`;

    for (const note of notes) {
      if (note.kind === "highlight") {
        md += `[划线] | 创建时间：${note.createdAtText}\n\n`;
        md += `${toBlockQuote(note.text)}\n\n`;
      } else {
        md += `[评论] | 创建时间：${note.createdAtText}\n\n`;
        md += `${note.text}\n\n`;
        if (note.abstract) {
          md += `${toBlockQuote(note.abstract)}\n\n`;
        }
      }

      md += `---\n\n`;
    }
  }

  return md;
}
