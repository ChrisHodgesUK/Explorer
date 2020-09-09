import 'ol/ol.css';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import TileLayer from 'ol/layer/Tile';
import XYZSource from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
//import VectorContext from 'ol/render/VectorContext';
import View from 'ol/View'
import OSMSource from 'ol/source/OSM'
import {GPX,KML} from 'ol/format';
import TileDebug from 'ol/source/TileDebug';
import {Style, Fill, Stroke} from 'ol/style';
import {fromLonLat} from 'ol/proj';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Icon from 'ol/style/Icon';
import {defaults as defaultInteractions, DragAndDrop} from 'ol/interaction';
let gpxParser = require('gpxparser');
import Chart from 'chart.js';

function rgb(r, g, b){
  r = Math.floor(r);
  g = Math.floor(g);
  b = Math.floor(b);
  return ["rgb(",r,",",g,",",b,")"].join("");
};

/**
 * Returns a hash code for a string.
 * (Compatible to Java's String.hashCode())
 *
 * The hash code for a string object is computed as
 *     s[0]*31^(n-1) + s[1]*31^(n-2) + ... + s[n-1]
 * using number arithmetic, where s[i] is the i th character
 * of the given string, n is the length of the string,
 * and ^ indicates exponentiation.
 * (The hash value of the empty string is zero.)
 *
 * @param {string} s a string
 * @return {number} a hash code value for the given string.
 * https://gist.github.com/hyamamoto/fd435505d29ebfa3d9716fd2be8d42f0
 */
function hashCode(s){
  var h = 0, l = s.length, i = 0;
  if ( l > 0 )
    while (i < l)
      h = (h << 5) - h + s.charCodeAt(i++) | 0;
  return h;
};

var tile= new TileLayer({
		source: new OSMSource
});


var tiles=    new TileLayer({
      source: new TileDebug()
    });

var dragAndDropInteraction = new DragAndDrop({
  formatConstructors: [
    GPX,
    KML,
  ]
});
var marker = new Feature({
  geometry: new Point(fromLonLat([-2.5,51.5])),
});
marker.setStyle(
  new Style({
    image: new Icon({
      color: '#ffffff',
      imgSize: [44,44],
      src: 'bikeicon-44px.png',
      anchor: [0.64, 0.1],
    }),
  })
);
//console.log(marker);
var vectorSource = new VectorSource({
  features: [marker],
});

var vectorLayer = new VectorLayer({
  source: vectorSource,
});
vectorLayer.setZIndex( 1001 ); 
console.log ("creating map");
var map= new Map({
  interactions: defaultInteractions().extend([dragAndDropInteraction]),
  target: 'map-container',
  layers: [tile, tiles,vectorLayer],
  view: new View({
    center: fromLonLat([-2.5,51.5]),
  zoom: 14
  })
});

var gpx = new gpxParser(); //Create gpxParser Object
var trackFilenames={};

//Create the plot, empty for now (or rather, hidden dummy data)

var ctx = document.getElementById('myChart').getContext('2d');
var myChart = new Chart(ctx, {
    type: 'scatter',
    data: {
        datasets: [{
            label: 'test',
            data: [{
            	x:0,
            	y:0
            },{
            	x:1,
            	y:1
            }],
            backgroundColor:'rgba(0, 0,0,0)',
            borderColor: 'rgba(0.0.0,0)',
            pointBorderColor:'rgba(0,0,0,0)',
	   	   	pointBorderWidth:0,
	   	   	pointBackgroundColor:'rgba(0,0,0,0)',
            borderWidth: 0,
            tension: 0,
            showLine: false,
            fill:false,
            pointHoverRadius: 10,
        }]
    },
    options: {
        scales: {
            yAxes: [{
                ticks: {
                    beginAtZero: true
                },
                scaleLabel: {
                	display: true,
                	labelString:'Cumulative climb / m'
                }
            }],
            xAxes: [{
                ticks: {
                    beginAtZero: true
                },
                scaleLabel: {
                	display: true,
                	labelString:'Distance  / km'
                }
            }]
        },
        legend: {
        	display:false
        },
		onHover: function(evt) {
		var item = myChart.getElementAtEvent(evt);
		if (item.length) {
			//console.log("onHover",item, evt.type);
			var index=item[0]._index
			//console.log(">data", index, myChart.data.datasets[0].data[item[0]._index]);
			var status = document.getElementById("location-status");
			var series=myChart.data.datasets[item[0]._datasetIndex]
			console.log(series.data[index]);
			status.innerHTML = series.label+": "+parseFloat(series.data[index].x)+" km, = "+(100*parseFloat(series.data[index].x)/parseFloat(series.data[series.data.length-1].x)).toFixed(0)+"%, "+series.data[index].y+" m cumulative climb = "+(100*series.data[index].y/series.data[series.data.length-1].y).toFixed(0)+
			"% <small><small>(altitude "+gpx.tracks[0].points[index].ele.toFixed(0)+" Lat, Long:"+gpx.tracks[0].points[index].lat.toFixed(4)+","+gpx.tracks[0].points[index].lon.toFixed(4)+")</small></small>";
			var dist=series.data[index].x;//it looks like chartjs returns the index in resampled data, so we have to find the cumulative distance in gpxparser's data instead of just using the index  
		    var trackNum=0
			for (trackNum=0; trackNum<gpx.tracks.length; trackNum++) {
		    	if (series.label==trackFilenames[gpx.tracks[trackNum].name]) {
		    		console.log("breaking");
		    		break;
		    	}
		    }
			var closestPoint = gpx.tracks[trackNum].distance.cumul.findIndex(function (element) {//not guaranteed to be closest but good enough 
		    		return element > (dist*1000)-10; 
		    }); 
		    var currentPoint = new Point(fromLonLat([gpx.tracks[trackNum].points[closestPoint].lon,gpx.tracks[trackNum].points[closestPoint].lat]));
		    var marker_to_update=vectorSource.getFeatures()[0];

		    marker_to_update.set('geometry', currentPoint);

		    


		}
		
  }}
});


//When a file is dropped on the map, do all the clever bits
dragAndDropInteraction.on('addfeatures', function(event) {
  var StrokeColour
  var vectorSource = new VectorSource({
    features: event.features
  });
  //console.log(event.file)
  if (event.file.type.includes("kml")){
  	  StrokeColour="red";
  } else { //GPX
  	  var red_component=Math.abs(hashCode(event.file.name) %32)*6;
   	  var green_component=(event.file.name.length%32)*6;
  	  StrokeColour=rgb(red_component,green_component,255);
  	  
  	  //Parse to get coordinates and elevations
 	  
  	  var fr=new FileReader(); 
  	  var total_climb=0
  	  var threshold_climb=0.3 //minimum climb between consecutive points required to count.  Should be zero but matches Strava better if 0.3 (metres) 
  	  var height_diff=0
  	  var distance=[];
  	  var climb_so_far=[];
  	  fr.onload=function(){ 
		var route_text=fr.result; 
		gpx.parse(route_text); //parse gpx file from string data
		var trackNum=gpx.tracks.length-1;
		trackFilenames[gpx.tracks[trackNum].name]=event.file.name;
		console.log(trackFilenames);

		var arrayLength = gpx.tracks[trackNum].points.length;
		for (var i = 0; i < arrayLength; i++) {
			if (i>0){
				height_diff=gpx.tracks[trackNum].points[i].ele-gpx.tracks[trackNum].points[i-1].ele
				if (height_diff>threshold_climb){
					total_climb+=height_diff;
					climb_so_far.push(Math.floor(total_climb));//Climb to nearest 1m
					distance.push(gpx.tracks[trackNum].distance.cumul[i])//Distance to nearest 10m
				}
			}
		}
		total_climb=Math.floor(total_climb)
		console.log("total_climb",total_climb )
		var total_distance=Math.floor(gpx.tracks[trackNum].distance.total/100)/10 //round to nearest 100m
		var para=document.createElement("p");
		var node=document.createTextNode(event.file.name.concat(":\n\xa0Distance=",total_distance,"\xa0km ", "\xa0Climb=",total_climb,"\xa0m"));
		para.appendChild(node);
		para.style.color=StrokeColour
		var element=document.getElementById("legend");
		element.appendChild(para);
		
		//chart.js to plot cumulative elevation from the arrays above
		//perhaps also rolling elevation
		const plotdata = distance.map((x, i) => {
		  return {
			x: (x/1000).toFixed(1),
			y: climb_so_far[i]
		  };
		  
	   });
	   myChart.data.datasets.push({
	   		   label: event.file.name,
	   	   	   data: plotdata,
	   	   	   borderColor:StrokeColour,
	   	   	   borderwidth:5,
               tension: 0,
	   	   	   showLine:true,
	   	   	   fill:false,
	   	   	   pointBorderColor:'rgba(0,0,0,0)',
	   	   	   pointBorderWidth:0,
	   	   	   pointBackgroundColor:'rgba(0,0,0,0)',
	   	   	   pointHitRadius:5,
	   	   	      	   	   
	   	   	   
	   });
	   myChart.update();

      } 
          
      fr.readAsText(event.file); 
  }

  map.addLayer(new VectorLayer({
    source: vectorSource,
     style: new Style({
		fill: new Fill({
		  color: StrokeColour,
		}),
		stroke: new Stroke({
		  color: StrokeColour,
		  width: 5
    })   	
    })
  }));



  map.getView().fit(vectorSource.getExtent());
});


