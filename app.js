/**
 * A personal website with two mini apps, 
 * where users can check weather or make a to-do list.
 */

//Adding express
const express = require("express");
const app = express();
const https = require("https");

//Reading enviroment variables files.
require("dotenv").config();

//Google APIs
const {google} = require('googleapis')
//Google OAuth2
const OAuth2 = google.auth.OAuth2


const oauth2Client = new OAuth2(
  process.env.OAUTH_CLIENTID,
  process.env.OAUTH_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({
  refresh_token:process.env.OAUTH_REFRESH_TOKEN
});

const accessToken = oauth2Client.getAccessToken();

//Adding bodyParder library
const bodyParser = require("body-parser");

//Adding lodash library
const _ = require("lodash");

//Adding nodemailer module
const nodemailer = require("nodemailer");

//Adding mongoose library
const mongoose = require("mongoose");

//Connecting to mongoose server
mongoose.connect("mongodb+srv://admin-ben:BenAdmin09-@cluster0.sbk8wri.mongodb.net/listDB");

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

//Creating mongoose items Schema JSON
const itemsSchema = new mongoose.Schema ({
  name: {
    type : String,
    require : true
  }
});

//Creating an Item collection followed the itemsSchema JSON
const Item = mongoose.model("Item", itemsSchema);

//Item example
const item0 = new Item({
  name: "Contact Me if you're interested."
});

const defaultItems = [item0];

//Rendering home page
app.get("/", (req, res) => {
  res.render("list");
});

//Renderding contact page
app.get("/contact", (req, res) => {
  res.render("contact", {
    userName : null
  });
});

/**
 * Handles GET request to render projects's page.
 * @param: callback to add default items to the to-do list,
 *         or display items in the array, which is retrieved from
 *         mongoDB database
 */
app.get("/projects", (req, res) => {
  //Setting an array to save default item to the to-do list.
  let itemArray = [];

  //Finding all the documents of Item collections in the mongoDB.
  Item.find({}, function(err, result) {
    if (err) {
      console.log(err);
    } 
    
    else {
      //Adding a default item if the found data is empty.
      if(result.length === 0) {
        Item.insertMany(defaultItems, function(err) {
          if(err) {
            console.log(err);
          }

          else {
            console.log("Insertion Successfully.");
          }
        });
      }

      //Rendering user's end page with the to-do list and null weather info.
      res.render("projects", {
        listItem : result,
        weather : null
      });
    }
  });
});

/**
 * Makes an API call to openWeather to get weather's info 
 * and display it to the user via a Bootstrap modal.
 * @param: callback to get weather data from OpenWeather via an API call.
 */
app.post("/weather", (req, res) => {

  //Checking if user's input is empty.
  if(req.body.cityName === "") {
    res.redirect("/projects");
  }

  else {
    //Saving user's input for city name.
    const cityName = req.body.cityName;
    const apiURL = "https://api.openweathermap.org/data/2.5/weather?q=";
    const apiID = "&appid=2d622426a5aac4e589b872adfa100b2d";
    const units = "&units=imperial";

    //Concatenating city name & apiKey to url
    const url = apiURL + cityName + apiID + units;

    //Making an https GET request (API call) to openWeather
    https.get(url, (response) => {
      response.on("data", (data) => {
        //Checking if returned data is not null
        if (data != null) {
          //Parsing the returned data into JSON format
          const weatherData = JSON.parse(data);

          //Checking for 404 code (invalid city name)
          if(weatherData.cod == 404) {
            res.render("projects", {
              listItem : defaultItems,
              weather : weatherData,
              statusCode : weatherData.cod,
            });
          }

          //Display weather data to user's end.
          else {
            res.render("projects", {
              listItem : defaultItems,
              weather: weatherData,
              city: weatherData.name,
              temp: weatherData.main.temp,
              tempFeelsLike: weatherData.main.feels_like,
              icon: "http://openweathermap.org/img/wn/" + weatherData.weather[0].icon + "@2x.png",
              description: _.startCase(weatherData.weather[0].description),
              windSpeed: weatherData.wind.speed,
              statusCode : weatherData.cod
            });
          }
        }
      });
    });
  }
});

/**
 * Deletes an item from the to-do list that has the checkbox checked
 * @param: callback to find an item, which is a document, 
 *         and delete it from mongoDB.
 */
app.post("/delete", (req, res) => {
  //Saving the itemID, which is document's name
  const itemID = req.body.checkbox;

  //Finding a document by its Id and delete it
  Item.findByIdAndRemove(itemID, function(err, result) {

    if(err) {
      console.log(err);
    }

    else {
      console.log("Successfully Deleted.");
      res.redirect("/projects");
    }
  });
});

/**
 * Save and send contact's info via email to app's owner.
 * @param: callback uses nodemailer to access gmail via
 *         google Gmail API.
 */
app.post("/contact", (req, res) => {
  //Deconstructing user's input into variables
  const {name, email, message} = req.body;

  //Create a variable to access Gmail via OAuth2
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.MAIL_USERNAME,
      clientId: process.env.OAUTH_CLIENTID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      refreshToken: process.env.OAUTH_REFRESH_TOKEN,
      accessToken: accessToken
    }
  });

  //Adding email's info
  const mailOptions = {
    from: process.env.MAIL_USERNAME,
    to: "nghiaben7@gmail.com",
    subject: name + " sent you a message",
    text: message + " at " + email
  };

  //Sending email to app's owner.
  transporter.sendMail(mailOptions, function(err, data) {
    if (err) {
      console.log("Error " + err);
    } else {
      console.log("Successfully sent email!!!");
    }
  });

  //Inform user upon their infor has been well received.
  res.render("contact", {
    userName : name
  });
});

/**
 * Add an item to the current list
 */
app.post("/add", (req, res) => {
  const userInput = req.body.newItem;
  //Checking if user's input is null.

  if (userInput !== "") {
    //Creating a new item with the user input.
    const newItem = new Item({ name: req.body.newItem });
    
    //Saving the new item into the database
    newItem.save();
  }

  res.redirect("/projects");
});

app.listen(process.env.PORT || 3000, function() {
  console.log("Server started successfully");
});