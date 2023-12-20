let http = require("http");
let path = require("path");
const express = require('express');
const bodyParser = require("body-parser");
const app = express();
const session = require('express-session');
require("dotenv").config();

if (process.argv.length != 2) {
  process.stdout.write("Wrong format.");
  process.exit(1);
}

const user_name = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const database = process.env.MONGO_DB_NAME;
const collection = process.env.MONGO_COLLECTION;
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT;

let site = "http://localHost:" + port;
console.log(`Web server started and running at ${site}`);

http.createServer(app).listen(port);
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:false}));
process.stdin.setEncoding("utf8");
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  resave: false,
  saveUninitialized: true,  
  secret: 'SECRET' 
}));

process.stdout.write(`Stop to shutdown the server:`);
process.stdin.on("readable", function () {
    let dataInput = process.stdin.read();
    if (dataInput !== null) {
        let command = dataInput.trim();
        if (command === "stop") {
            process.stdout.write("Shutting down the server\n");
            process.exit(0);
        } else {
            process.stdout.write(`invalid command ${dataInput}`);
        }
        process.stdout.write(`Stop to shutdown the server:`);
        process.stdin.resume();
    }
});

var passport = require('passport');
var userProfile;

app.get('/', function(req, res) {
  res.render('login');
});

app.use(passport.initialize());
app.use(passport.session());

app.get('/dashboard', (req, res) => {
  res.render('dashboard', userProfile);
});

app.get("/search", (request, response) => {
  response.render("search");
});

let array = [];
let i = 0;
app.post("/search", async (request, response) => {
  let result;
  let name;
  let table = "<table border = '1'>";
  table += "<thead><tr><th>No.</th><th>Hotel Name</th><th>Address</th><th>Phone Number</th><th>Rating</th></tr></thead>";
  /* Replace all the space */
  name = request.body.name;
  name = name.replace(/\s/g, "%20");

  const url = `https://local-business-data.p.rapidapi.com/search?query=${name}&limit=5&zoom=13&language=en&region=us`;
  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key':  '254cc36cf0mshf0e5d68320bba6cp172491jsn3599f9a7951c',
      'X-RapidAPI-Host': 'local-business-data.p.rapidapi.com'
    }
  };
  fetch(url, options)
  .then(response => { 
    const result = response.json();
    return result;
  })
  .then(async jsonData => {               
    console.log("In then() of nodeFetch\n", jsonData.data[0], "\nEnd of then() of nodeFetch");
    if (Array.isArray(jsonData.data)){
      i = 0;
      jsonData.data.forEach(p => {
          array[i] = `<tr><td> ${p.name} </td><td> ${p.address} </td><td> ${p.phone_number} </td><td> ${p.rating} </td></tr>`;
          i++;
          table += `<tr><td>${i}</td><td> ${p.name} </td><td> ${p.address} </td><td> ${p.phone_number} </td><td> ${p.rating} </td></tr>`;
        });
  }
    table += "</table>";
    const variable = { data: table};
    response.render("searchResult",variable);
  });

});

app.post("/processInsert", async (request, response) => {
  let index = request.body.choose -1;

    let variables = {
      user_name: userProfile.displayName,
      user_id: userProfile.id,
      search_table: array[index]
    };
  await insert(variables);

  response.render("processInsert");
});

app.get("/adminUser", async(request, response) => {
  // response.render("adminUser");
  let user = userProfile.displayName;
  const result = await lookUpMany(user);
  const variable = { userTable : result}
  response.render("processAdminUser",variable);
});

// app.post("/adminUser", async(request, response) => {
//   let user = request.body.user;
//   const result = await lookUpMany(user);
//   const variable = { userTable : result}
//   response.render("processAdminUser",variable);
// });

app.get("/cleanUp", (request, response) => {
  response.render("cleanUp");
});

app.post("/cleanUp", async(request, response) => {
  const variable = {delectedNum: await remove()};
  response.render("processCleanUp", variable);
});  

app.get('/error', (req, res) => res.send("error logging in"));

passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const { traceDeprecation } = require("process");
const GOOGLE_CLIENT_ID = process.env.CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.CLIENT_SECRET;

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `http://localhost:${port}/login/google/callback`
  },
  function(accessToken, refreshToken, profile, done) {
      userProfile=profile;
      return done(null, userProfile);
  }
));

app.get('/login/google', 
  passport.authenticate('google', { scope : ['profile', 'email'] }));

app.get('/login/google/callback', 
  passport.authenticate('google', { failureRedirect: '/error' }),
  function(req, res) {

    res.redirect('/dashboard');
  });

async function insert(value) {
  const uri = `mongodb+srv://${user_name}:${password}@cluster0.51ntzsa.mongodb.net/?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  try {
      await client.connect();
      await client.db(database).collection(collection).insertOne(value);
  } catch(e) {
      console.error(e);
  } finally {
      await client.close();
  }
}

async function lookUpMany(google_id) {
  count = 0;
  const uri = `mongodb+srv://${user_name}:${password}@cluster0.51ntzsa.mongodb.net/?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  try {
      await client.connect();
      let filter = { user_name: google_id };
      const cursor = await client.db(database).collection(collection).find(filter);
      const result = await cursor.toArray();
      table = "<table border ='2'><thead><tr><th>Name</th><th>Address</th><th>Phone Number</th><th>Rating</th></tr></thead>";
      result.forEach((element) => {
          table += element.search_table 
      });
      table += "</table>";
      return table;
  } catch(e) {
      console.error(e);
  } finally {
      await client.close();
  }
}

async function remove() {
  const uri = `mongodb+srv://${user_name}:${password}@cluster0.51ntzsa.mongodb.net/?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  let count = 0;
    try {
        await client.connect();
        const result = await client.db(database).collection(collection).deleteMany({});
        count = result.deletedCount;
        return count;
  } catch(e) {
      console.error(e);
  } finally {
      await client.close();
  }
}