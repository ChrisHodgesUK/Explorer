import 'ol/ol.css';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import TileLayer from 'ol/layer/Tile';
import XYZSource from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import View from 'ol/View'
import OSMSource from 'ol/source/OSM'
import {GPX,KML} from 'ol/format';
import TileDebug from 'ol/source/TileDebug';
import {Style, Fill, Stroke} from 'ol/style';
import {fromLonLat} from 'ol/proj';
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
console.log ("creating map");
var map= new Map({
  interactions: defaultInteractions().extend([dragAndDropInteraction]),
  target: 'map-container',
  layers: [tile, tiles],
  view: new View({
    center: fromLonLat([-2.5,51.5]),
  zoom: 14
  })
});

//Create the plot, empty for now (or rather, dummy data)

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
            fill:false
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
        }
    }
});


//When a file is dropped on the map, do all the clever bits
dragAndDropInteraction.on('addfeatures', function(event) {
  var StrokeColour
  var vectorSource = new VectorSource({
    features: event.features
  });
  console.log(event.file)
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
		var gpx = new gpxParser(); //Create gpxParser Object
		gpx.parse(route_text); //parse gpx file from string data
		var arrayLength = gpx.tracks[0].points.length;
		for (var i = 0; i < arrayLength; i++) {
			if (i>0){
				height_diff=gpx.tracks[0].points[i].ele-gpx.tracks[0].points[i-1].ele
				if (height_diff>threshold_climb){
					total_climb+=height_diff;
					climb_so_far.push(Math.floor(total_climb));//Climb to nearest 1m
					distance.push(Math.floor(gpx.tracks[0].distance.cumul[i]/10)/100)//Distance to nearest 10m
				}
			}
		}
		total_climb=Math.floor(total_climb)
		console.log("total_climb",total_climb )
		var total_distance=Math.floor(gpx.tracks[0].distance.total/100)/10 //round to nearest 100m
		//console.log("total distance",total_distance )
		//console.log("total climb (GPXparser)",Math.floor(gpx.tracks[0].elevation.pos))
		//console.log(distance)
		//console.log(climb_so_far)
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
			x: x,
			y: climb_so_far[i]
		  };
		  
	   });
	   console.log(plotdata)
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
	   console.log(myChart.data)
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


/*
var zoomtogpx = document.getElementById('zoomtogpx');
zoomtogpx.addEventListener('click', function() {
  var feature = gpx.getSource().getFeatures()[0];
  var polygon = feature.getGeometry();
  map.getView().fit(polygon, {padding: [170, 50, 30, 150]});
}, false);*/