const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const mysql = require("mysql2");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Database Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "typing_battle",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL Database: typing_battle");
});

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Ranking API
app.get("/api/ranking", async (req, res) => {
  try {
    const query = `
            SELECT u.username, MAX(s.wpm) as top_wpm, AVG(s.accuracy) as avg_accuracy, COUNT(s.id) as total_games
            FROM users u
            JOIN user_stats s ON u.id = s.user_id
            GROUP BY u.id
            ORDER BY top_wpm DESC
            LIMIT 10
        `;
    const [rows] = await db.promise().execute(query);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching ranking:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Game Logic Data
const rooms = {};
const sentences = [
  "Orang boleh pandai setinggi langit, tapi selama ia tidak menulis, ia akan hilang di dalam masyarakat dan dari sejarah. Menulis adalah bekerja untuk keabadian.", // Pramoedya Ananta Toer
  "Kesalahan orang-orang pandai ialah menganggap yang lain bodoh, dan kesalahan orang-orang bodoh ialah menganggap orang-orang lain pandai", // Pramoedya Ananta Toer
  "I can see the sun, but even if I cannot see the sun, I know that it exists. And to know that the sun is there - that is living.", // Fyodor Dostoevsky
  "Above all, don't lie to yourself. The man who lies to himself and listens to his own lie comes to a point that he cannot distinguish the truth within him, or around him, and so loses all respect for himself and for others. And having no respect he ceases to love.", // Fyodor Dostoevsky
  "If you're lonely when you're alone, you're in bad company.", // Jean-Paul Sartre
  "I'm going to smile, and my smile will sink down into your pupils, and heaven knows what it will become.", // Jean-Paul Sartre
  "People demand freedom of speech as a compensation for the freedom of thought which they seldom use.", // Søren Kierkegaard
  "Love is the expression of the one who loves, not of the one who is loved. Those who think they can love only the people they prefer do not love at all. Love discovers truths about individuals that others cannot see", // Søren Kierkegaard
  "I'm not upset that you lied to me, I'm upset that from now on I can't believe you.", // Friedrich Nietzsche
  "Sometimes people don't want to hear the truth because they don't want their illusions destroyed.", // Friedrich Nietzsche
  "Daun yang jatuh tak pernah membenci angin. Dia membiarkan dirinya jatuh begitu saja. Tak melawan, mengikhlaskan semuanya.", // Tere Liye
  "Jika kita mengkhawatirkan setiap langkah yang kita buat, kita akhirnya tidak akan pernah berani melangkah.", // Tere Liye
  "Bila kaum muda yang telah belajar di sekolah dan menganggap dirinya terlalu tinggi dan pintar untuk melebur dengan masyarakat yang bekerja dengan cangkul... maka lebih baik pendidikan itu tidak diberikan sama sekali.", // Tan Malaka
  "Bahwa kebiasaan menghafal itu tidak menambah kecerdasan, malah menjadikan saya bodoh, mekanis, seperti mesin.", // Tan Malaka
  "Kalau suatu negara seperti Amerika mau menguasai samudra dan dunia, dia mesti rebut Indonesia lebih dahulu buat sendi kekuasaan.", // Tan Malaka
  "Bila seseorang ingin menaiki tangga sosial dan kebudayaan mestilah merdeka lebih dulu dan pengetahuan tentang kemerdekaan, di Baratlah dilahirkan dan dipergunakan.", // Tan Malaka
  "Tidak ada gunanya memiliki IQ tinggi namun pemalas, tidak disiplin, dan tidak fokus. Yang penting adalah kesehatan, kemauan untuk berkorban, konsistensi, dan disiplin.", // B.J Habibie
  "Politik adalah penting tetapi yang lebih penting adalah manusia yang memiliki wawasan teknis dalam bidangnya masing-masing untuk membangun karya-karya nyata.", // B.J Habibie
  "Ainun banyak membaca Al-Qur'an, buku-buku tentang budaya Islam, dan sering berdiskusi dengan saya.", // B.J Habibie
  "Mereka memiliki jiwa nasionalisme yang tinggi. Mereka siap menghadapi segala permasalahan. Mereka pulang untuk memulai segalanya dari permulaan.", // B.J Habibie
  "Hal paling menakjubkan dari karya sastra-khususnya puisi dan kosmologi, keduanya merupakan pengembaraan hening. Suatu perjalanan menuju jantung kelengangan, mencapai bilik dan ruang yang belum bernama karena kata tak pernah cukup untuk menjamahnya.", // Karlina Supelli
  "Manusia bukan sekadar penghasil pengetahuan, tetapi juga makhluk yang harus mempertanggungjawabkan pengetahuannya.", // Karlina Supelli
  "Mengenal batas pengetahuan bukan berarti menjadi lemah, tetapi justru menjadi lebih bijaksana.", // Karlina Supelli
  "A mother's love for her child is like nothing else in the world. It knows no law, no pity. It dares all things and crushes down remorselessly all that stands in its path.", // Agatha Christie
  "Why shouldn't I hate her? She did the worst thing to me that anyone can do to anyone else. Let them believe that they're loved and wanted and then show them that it's all a sham.", // Agatha Christie
  "It is really a hard life. Men will not be nice to you if you are not good-looking, and women will not be nice to you if you are.", // Agatha Christie
  "It's like all those quiet people, when they do lose their tempers they lose them with a vengeance.", // Agatha Christie
  "But I know human nature, my friend, and I tell you that, suddenly confronted with the possibility of being tried for murder, the most innocent person will lose his head and do the most absurd things.", // Agatha Christie
];

// Socket.io connection
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join-room", async ({ username, roomCode }) => {
    socket.join(roomCode);

    if (!rooms[roomCode]) {
      const sentence = sentences[Math.floor(Math.random() * sentences.length)];

      // Simpan game ke database saat room dibuat
      let gameId = 1;
      try {
        const [result] = await db
          .promise()
          .execute("INSERT INTO games (sentence) VALUES (?)", [sentence]);
        gameId = result.insertId;
      } catch (err) {
        console.error("Error creating game in DB:", err);
      }

      rooms[roomCode] = {
        players: {},
        sentence: sentence,
        status: "waiting",
        gameId: gameId,
      };
    }

    rooms[roomCode].players[socket.id] = {
      username,
      progress: 0,
      wpm: 0,
      accuracy: 100,
      isFinished: false,
      isReady: false,
    };

    io.to(roomCode).emit("update-players", rooms[roomCode].players);
    io.to(roomCode).emit("room-info", {
      sentence: rooms[roomCode].sentence,
      status: rooms[roomCode].status,
    });
  });

  socket.on("toggle-ready", (roomCode) => {
    if (rooms[roomCode] && rooms[roomCode].players[socket.id]) {
      const player = rooms[roomCode].players[socket.id];
      player.isReady = !player.isReady;

      io.to(roomCode).emit("update-players", rooms[roomCode].players);

      // Cek apakah semua pemain sudah siap
      const playersInRoom = Object.values(rooms[roomCode].players);
      const allReady = playersInRoom.every((p) => p.isReady);

      // Minimal 2 pemain untuk memulai (sesuai kriteria minimum)
      if (allReady && playersInRoom.length >= 2) {
        rooms[roomCode].status = "playing";
        io.to(roomCode).emit("game-started");
      }
    }
  });

  socket.on("start-game", (roomCode) => {
    // Kita gunakan toggle-ready saja agar lebih konsisten
  });

  socket.on("typing-progress", ({ roomCode, progress, wpm, accuracy }) => {
    if (rooms[roomCode] && rooms[roomCode].players[socket.id]) {
      rooms[roomCode].players[socket.id].progress = progress;
      rooms[roomCode].players[socket.id].wpm = wpm;
      rooms[roomCode].players[socket.id].accuracy = accuracy;

      io.to(roomCode).emit("update-players", rooms[roomCode].players);
    }
  });

  socket.on("finish-game", async ({ roomCode, stats }) => {
    if (rooms[roomCode] && rooms[roomCode].players[socket.id]) {
      const player = rooms[roomCode].players[socket.id];
      player.isFinished = true;
      player.wpm = stats.wpm;
      player.accuracy = stats.accuracy;

      console.log(
        `Player ${player.username} finished with WPM: ${stats.wpm}, Acc: ${stats.accuracy}%`,
      );

      // Simpan statistik ke database
      try {
        // Cari atau buat user berdasarkan username
        const [userRows] = await db
          .promise()
          .execute("SELECT id FROM users WHERE username = ?", [
            player.username,
          ]);
        let userId;

        if (userRows.length === 0) {
          const [insertResult] = await db
            .promise()
            .execute("INSERT INTO users (username) VALUES (?)", [
              player.username,
            ]);
          userId = insertResult.insertId;
        } else {
          userId = userRows[0].id;
        }

        // Masukkan ke user_stats menggunakan gameId dari room
        const query =
          "INSERT INTO user_stats (user_id, game_id, wpm, error_rate, accuracy) VALUES (?, ?, ?, ?, ?)";
        await db
          .promise()
          .execute(query, [
            userId,
            rooms[roomCode].gameId,
            stats.wpm,
            stats.errorRate,
            stats.accuracy,
          ]);
        console.log("Stats saved to DB for user:", player.username);
      } catch (error) {
        console.error("Error saving to DB:", error);
      }

      io.to(roomCode).emit("player-finished", {
        id: socket.id,
        stats: player,
      });

      // Cek apakah semua pemain sudah selesai
      const allPlayers = Object.values(rooms[roomCode].players);
      const allFinished = allPlayers.every((p) => p.isFinished);

      if (allFinished) {
        rooms[roomCode].status = "finished";
        io.to(roomCode).emit("all-players-finished", rooms[roomCode].players);
      }
    }
  });

  socket.on("rematch", async (roomCode) => {
    if (rooms[roomCode]) {
      const sentence = sentences[Math.floor(Math.random() * sentences.length)];

      // Simpan game baru ke database saat rematch
      let gameId = 1;
      try {
        const [result] = await db
          .promise()
          .execute("INSERT INTO games (sentence) VALUES (?)", [sentence]);
        gameId = result.insertId;
      } catch (err) {
        console.error("Error creating game in DB during rematch:", err);
      }

      rooms[roomCode].status = "waiting";
      rooms[roomCode].sentence = sentence;
      rooms[roomCode].gameId = gameId;

      // Reset status setiap pemain
      for (const id in rooms[roomCode].players) {
        rooms[roomCode].players[id].progress = 0;
        rooms[roomCode].players[id].wpm = 0;
        rooms[roomCode].players[id].accuracy = 100;
        rooms[roomCode].players[id].isFinished = false;
        rooms[roomCode].players[id].isReady = false;
      }

      io.to(roomCode).emit("update-players", rooms[roomCode].players);
      io.to(roomCode).emit("room-info", {
        sentence: rooms[roomCode].sentence,
        status: rooms[roomCode].status,
      });
      io.to(roomCode).emit("rematch-started");
    }
  });

  socket.on("disconnect", () => {
    for (const roomCode in rooms) {
      if (rooms[roomCode].players[socket.id]) {
        delete rooms[roomCode].players[socket.id];
        if (Object.keys(rooms[roomCode].players).length === 0) {
          delete rooms[roomCode];
        } else {
          io.to(roomCode).emit("update-players", rooms[roomCode].players);
        }
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
