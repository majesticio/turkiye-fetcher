
// console.log(typeof stations)
const requests = stations.map((station) => {
    // map over the stations array
    return (done) => {
      request(BASE_URL, (err, res, body) => {
        // make a request for each station err = error, res = response, body = body of the response
        if (err || res.statusCode !== 200) {
          return done({ message: `Failure to load data url (${url})` });
        }
        let data = Object.assign(station, { body: body }); // add the body to the station object
        return done(null, data);
      });
    };
  });
  
  function fetchData(source, cb) {
    /**
   * Given fetched data, turn it into a format our system can use.
   * @param {object} results Fetched source data and other metadata
   * @return {object} Parsed and standarized data our system can use
   */
    // fetch the data, source = stations, cb = callback
    // Fetching both the main data page as well as a page to get all
    // coordinates for locations
    parallel(requests, (err, results) => {
      if (err) {
        return cb(err);
      }
      // Wrap everything in a try/catch in case something goes wrong
      try {
        // Format the data
        const data = formatData(results); // format the data, results = data from the requests
        // Make sure the data is valid
        if (data === undefined) {
          // undefined = no data
          return cb({ message: 'Failure to parse data.' });
        }
        return cb(null, data);
      } catch (e) {
        return cb(e);
      }
    });
  }
  
  
  
  //keys are from adairquality.com and values are OpenAQ names of parameters
  const validParameters = {
    PM10: { 'value': 'pm10', 'unit' : 'µg/m3' },
    O3: { 'value' : 'o3', 'unit' : 'µg/m3 ' },
    SO2: {'value' : 'so2' , 'unit' : 'µg/m3 '},
    NO2: {'value' : 'no2', 'unit' : 'µg/m3 ' },
    CO: { 'value' : 'co', 'unit' : 'mg/m3'},
  };
  
  function formatData(locations) {
    let out = [];
    for (const location of locations) {
      const body = JSON.parse(location.body);
      const measurements = JSON.parse(body.JSONDataResult)
        .map((o) => {
          const date = parseDate(o.DateTime)
          o.DateTime = date;
          return o;
        })
      const measurementsSorted = measurements.sort((a, b) => b.DateTime - a.DateTime);
      const latestMeasurements = measurementsSorted[0];
      const filtered = Object.entries(latestMeasurements).filter(([key, _]) => {
        return key in validParameters;
      }).map(o => {
        return {
          "parameter": validParameters[o[0]].value, 
          "unit": validParameters[o[0]].unit, 
          "value": o[1]
        }
      });
      const data = filtered.map((measurement) => {
        return {
          parameter: measurement.parameter,
          unit: measurement.unit,
          date: {
            utc: latestMeasurements.DateTime.toUTC().toISO(),
            local: latestMeasurements.DateTime.toISO(),
          },
          value: measurement.value,
          location: 'AE',
          city: location.city,
          coordinates: {
            latitude: location.coordinates.latitude,
            longitude: location.coordinates.longitude,
          },
          attribution: [
            {
              name: 'Abu Dhabi Air Quality',
              url: 'https://www.adairquality.com/',
            },
            {
              name: 'Abu Dhabi Environment and Protected Areas Authority',
              url: 'https://www.epa.gov.ae/',
            },
          ],
          averagingPeriod: { unit: 'hours', value: 1 }
        }
      });
      out.push(data);
    }
    return {name: 'unused', measurements:out.flat()};
  }
  
  
  function writeFile(data) {
    fs.writeFileSync('./out.json', JSON.stringify(data))
  }
  
  fetchData({}, (err, e) => writeFile(e));