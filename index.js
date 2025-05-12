const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const path = require("path");

const app = express();
const port = 3000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:9000", // Replace with your frontend URL (e.g., Quasar dev server)
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allowed HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  })
);
app.use(express.json());

// app.get("/api/data", (req, res) => {
//   res.status(200).json({
//     status: "successfull",
//     message: "hello from the backend",
//   });
// });

// Endpoint to fecth formats YouTube video
app.post("/api/youtube/formats", (req, res) => {
  // const { videoUrl } = req.body;

  // if (!videoUrl) {
  //   return res.status(400).json({ error: "Video URL is required" });
  // }

  // // Run yt-dlp command
  // exec(`yt-dlp --list-formats ${videoUrl}`, (error, stdout, stderr) => {
  //   if (error) {
  //     console.error(`Error: ${error.message}`);
  //     return res.status(500).json({ error: "Failed to download video" });
  //   }
  //   if (stderr) {
  //     console.error(`Stderr: ${stderr}`);
  //   }

  //   const formats = parseFormats(stdout);

  //   console.log(formats);

  //   res.status(200).json({ formats });

  //   // console.log(`Stdout: ${stdout}`);
  //   // res.status(200).json({ message: stdout, output: stdout });
  // });

  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: "Video URL is required" });
  }

  // Fetch video title
  exec(
    `yt-dlp --get-title ${videoUrl}`,
    (titleError, titleStdout, titleStderr) => {
      if (titleError) {
        console.error(`Error fetching title: ${titleError.message}`);
        return res.status(500).json({ error: "Failed to fetch video title" });
      }

      const title = titleStdout.trim();

      // Fetch video thumbnail URL
      exec(
        `yt-dlp --get-thumbnail ${videoUrl}`,
        (thumbnailError, thumbnailStdout, thumbnailStderr) => {
          if (thumbnailError) {
            console.error(
              `Error fetching thumbnail: ${thumbnailError.message}`
            );
            return res
              .status(500)
              .json({ error: "Failed to fetch video thumbnail" });
          }

          const thumbnail = thumbnailStdout.trim();

          // Fetch available formats
          exec(
            `yt-dlp --list-formats ${videoUrl}`,
            (formatsError, formatsStdout, formatsStderr) => {
              if (formatsError) {
                console.error(
                  `Error fetching formats: ${formatsError.message}`
                );
                return res
                  .status(500)
                  .json({ error: "Failed to fetch formats" });
              }

              // Parse the output to extract format information
              const formats = parseFormats(formatsStdout);

              // console.log(formats);

              // Send the response with title, thumbnail, and formats
              res.status(200).json({ title, thumbnail, formats });
            }
          );
        }
      );
    }
  );
});

// Download the video with the formats
app.post("/api/youtube/download", (req, res) => {
  const { videoUrl, formatId } = req.body;

  if (!videoUrl || !formatId) {
    return res
      .status(400)
      .json({ error: "Video URL and format ID are required" });
  }

  // Run yt-dlp with the selected format
  exec(`yt-dlp -f ${formatId} ${videoUrl}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return res.status(500).json({ error: "Failed to download video" });
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
    }

    console.log(`Stdout: ${stdout}`);
    res.status(200).json({ message: "Download completed!", output: stdout });
  });
});

// Helper function for arranging foramts
// function parseFormats(output) {
//   const lines = output.split("\n");
//   const formats = [];

//   // Extract format information
//   for (const line of lines) {
//     if (
//       line.includes("video only") ||
//       line.includes("audio only") ||
//       line.includes("mp4")
//     ) {
//       const parts = line.split(/\s+/);
//       console.log("------------parts", parts);
//       const formatId = parts[0]; // ID
//       const resolution = parts[3]; // RESOLUTION
//       const formatNote = parts.slice(5).join(" "); // Additional info
//       let size = "";
//       let videoQuality = "";
//       let audioQuality = "";
//       parts.forEach((el) => {
//         if (el.includes("MiB")) {
//           size = el;
//         }
//         // Taking video quality
//         if (el.includes("mp4" && "144p")) {
//           videoQuality = el;
//         } else if (el.includes("mp4" && "240p")) {
//           videoQuality = el;
//         } else if (el.includes("mp4" && "360p")) {
//           videoQuality = el;
//         } else if (el.includes("mp4" && "420p")) {
//           videoQuality = el;
//         } else if (el.includes("mp4" && "720p")) {
//           videoQuality = el;
//         } else if (el.includes("mp4" && "1080p")) {
//           videoQuality = el;
//         }

//         // TAKING AUDIO QUALITIES
//         if (el.includes("audio")) {
//           audioQuality = el;
//         }
//       });

//       formats.push({
//         formatId,
//         resolution,
//         size, // Add size to the formats array
//         videoQuality,
//         audioQuality,
//         formatNote,
//       });
//     }
//   }

//   return formats;
// }

function parseFormats(output) {
  const lines = output.split("\n");

  const videoFormats = [];
  const audioFormats = [];
  const resolutionOrder = ["144p", "240p", "360p", "480p", "720p", "1080p"];

  for (const line of lines) {
    if (line.includes("video") || line.includes("mp4")) {
      const parts = line.split(/\s+/);

      const formatId = parts[0];
      const resolution = parts[2];
      const size = parts[5];
      const formatNote = parts.slice(5).join(" ");

      // Convert resolution to standard labels (e.g., "1920x1080" -> "1080p")

      let resolutionLabel = "";
      if (resolution.includes("x")) {
        const height = resolution.split("x")[1];
        resolutionLabel = `${height}p`;
      }

      if (resolutionOrder.includes(resolutionLabel)) {
        videoFormats.push({
          formatId,
          resolution: resolutionLabel,
          size,
          formatNote,
          type: "video",
        });
      }
    }
    if (line.includes("audio")) {
      console.log("the audio is included");

      const parts = line.split(/\s+/);
      const formatId = parts[0];
      const size = parts[4]; // File size (e.g., "3.2MiB")
      const formatNote = parts.slice(5).join(" "); // e.g., "audio only tiny"

      audioFormats.push({
        formatId,
        resolution: "Audio",
        size,
        formatNote,
        type: "audio",
      });
    }
  }

  // Sort video formats by resolution (144p -> 1080p)
  videoFormats.sort((a, b) => {
    return (
      resolutionOrder.indexOf(a.resolution) -
      resolutionOrder.indexOf(b.resolution)
    );
  });

  // Sort audio formats by size (largest to smallest)
  audioFormats.sort((a, b) => {
    const sizeA = parseFloat(a.size.replace("MiB", "").replace("KiB", ""));
    const sizeB = parseFloat(b.size.replace("MiB", "").replace("KiB", ""));
    return sizeB - sizeA; // Descending order
  });

  // Combine video and audio formats
  return [...videoFormats, ...audioFormats];
}

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
