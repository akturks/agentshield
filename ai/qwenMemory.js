import fs from "fs";
import path from "path";

const MEMORY_ROOT =
  path.join(
    process.cwd(),
    "qwen3-memory"
  );

export function saveMemory({
  category,
  title,
  content
}) {

  const safeTitle =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

  const filename =
    `${Date.now()}-${safeTitle}.md`;

  const filepath =
    path.join(
      MEMORY_ROOT,
      category,
      filename
    );

  fs.writeFileSync(
    filepath,
    content,
    "utf8"
  );

  return filepath;
}

export function searchMemory(
  keyword
) {

  const results = [];

  const categories = [
    "investigations",
    "decisions",
    "architecture",
    "lessons"
  ];

  for (
    const category of categories
  ) {

    const dir =
      path.join(
        MEMORY_ROOT,
        category
      );

    if (
      !fs.existsSync(dir)
    ) {
      continue;
    }

    const files =
      fs.readdirSync(dir);

    for (
      const file of files
    ) {

      const fullPath =
        path.join(
          dir,
          file
        );

      const text =
        fs.readFileSync(
          fullPath,
          "utf8"
        );

      if (
        text
          .toLowerCase()
          .includes(
            keyword.toLowerCase()
          )
      ) {
        results.push({
          file,
          category,
          path: fullPath
        });
      }
    }
  }

  return results;
}
