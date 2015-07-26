/*
    Copyright (C) 2015  Humanitarian OpenStreetMap Team

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/
exports = {}
exports.detail = (function(){
    
        
    return {
        init: function(){
            parts = window.location.href.split('/');
            var job_uid = parts[parts.length -2];
            exports.detail.job_uid = job_uid;
            exports.detail.timer = false;
            initMap();
            loadJobDetail();
            loadSubmittedRunDetails();
            loadCompletedRunDetails();
        },
    }
    
    /**
     * Initialize the export overview map.
     */
    function initMap(){
        maxExtent = new OpenLayers.Bounds(-180,-90,180,90).transform("EPSG:4326", "EPSG:3857");
        var mapOptions = {
                displayProjection: new OpenLayers.Projection("EPSG:4326"),
                controls: [new OpenLayers.Control.Attribution(),
                           new OpenLayers.Control.ScaleLine()],
                maxExtent: maxExtent,          
                scales:[500000,350000,250000,100000,25000,20000,15000,10000,5000,2500,1250],   
                units: 'm',
                sphericalMercator: true,
                noWrap: true // don't wrap world extents
        }
        map = new OpenLayers.Map('extents', {options: mapOptions});
        // restrict extent to world bounds to prevent panning..
        map.restrictedExtent = new OpenLayers.Bounds(-180,-90,180,90).transform("EPSG:4326", "EPSG:3857");
        
        // add base layers
        osm = Layers.OSM
        osm.options = {layers: "basic", isBaseLayer: true, visibility: true, displayInLayerSwitcher: true};
        map.addLayer(osm);
        map.zoomToMaxExtent();
        
        job_extents = new OpenLayers.Layer.Vector('extents', {
            displayInLayerSwitcher: false,
            style: {
                strokeWidth: 3.5,
                strokeColor: '#D73F3F',
                fillColor: 'transparent',
                fillOpacity: 0.8,
            }
        });
        
        map.addLayer(job_extents);
        return map;
    }
  
    /**
     * Loads the job details.
     */
    function loadJobDetail(){
        var job_uid = exports.detail.job_uid;
        $.getJSON(Config.JOBS_URL + '/' + job_uid, function(data){
            // keep a reference to the job..
            exports.detail.job = data;
            $('#uid').html(data.uid);
            $('#name').html(data.name);
            $('#description').html(data.description);
            var created = moment(data.created_at).format('h:mm:ss a, MMMM Do YYYY');
            $('#created').html(created);
            var formats = data.exports;
            for (i = 0; i < formats.length; i++){
                $('#formats').append(formats[i].name + '<br/>');
            }
            var extent = data.extent;
            var geojson = new OpenLayers.Format.GeoJSON({
                    'internalProjection': new OpenLayers.Projection("EPSG:3857"),
                    'externalProjection': new OpenLayers.Projection("EPSG:4326")
            });
            var feature = geojson.read(extent);
            job_extents.addFeatures(feature);
            map.zoomToExtent(job_extents.getDataExtent());
        });
        
        // handle re-run click events..
        $('button#rerun').bind('click', function(e){
           $.get(Config.RERUN_URL + exports.detail.job_uid,
                function(data, textStatus, jqXhr){
                    // initialize the submitted run panel immediately
                    initSumtittedRunPanel([data]);
                    // then start the check interval..
                    startRunCheckInterval();
            });
        });
    }
    
    /**
      * Loads the completed run details.
      * 
      * Parameters:
      * expand_first {Object} - whether to expand the first completed run.
      */
    function loadCompletedRunDetails(expand_first){
        var job_uid = exports.detail.job_uid;
        var $runPanel = $('#completed_runs > .panel-group');
        $.getJSON(Config.RUNS_URL + '?status=COMPLETED&job_uid=' + job_uid, function(data){
            // clear the completed run panel
            $runPanel.empty();
            // hide the submitted run panel
            if (!exports.detail.timer) {
                $('#submitted_runs > .panel-group').empty();
                $('#submitted_runs').css('display', 'none');
            }
            
            $.each(data, function(index, run){
                var started = moment(run.started_at).format('h:mm:ss a, MMMM Do YYYY');
                var finished = moment(run.finished_at).format('h:mm:ss a, MMMM Do YYYY');
                var duration = moment.duration(run.duration).humanize();
                var status_class = run.status === 'COMPLETED' ? 'alert alert-success' : 'alert alert-warning';
                var expanded = !exports.detail.timer && index === 0 ? 'in' : '';
                var context = { 'run_uid': run.uid, 'status': run.status,
                                'started': started, 'finished': finished,
                                'duration': duration,'status_class': status_class,
                                'expanded': expanded};
                var template = getCompletedRunTemplate();
                var html = template(context);
                $runPanel.append(html);
                
                // add task info
                $taskDiv = $runPanel.find('div#' + run.uid).find('#tasks').find('table');
                var tasks = run.tasks;
                $.each(tasks, function(i, task){
                    var result = task.result;
                    var status = task.status;
                    var duration = numeral(task.duration).format("HH:mm:ss.SSS");
                    switch (task.name) {
                        case 'KML Export':
                            $taskDiv.append('<tr><td><a href="' + result.url + '">Google Earth (KMZ) File</a></td><td>' + duration + '</td><td>' +
                                    result.size + '</td></tr>');
                            break;
                        case 'OSM2PBF':
                            $taskDiv.append('<tr><td><a href="' + result.url + '">OpenStreetMap (PBF) File</a></td><td>' + duration + '</td><td>' +
                                    result.size + '</td></tr>');
                            break;
                        case 'Shapefile Export':
                            $taskDiv.append('<tr><td><a href="' + result.url + '">ESRI Shapefile (SHP)</a></td><td>' + duration + '</td><td>' +
                                    result.size + '</td></tr>');
                            break;
                        case 'OBF Export':
                            $taskDiv.append('<tr><td><a href="' + result.url + '">OSMAnd (OBF) File</a></td><td>' + duration + '</td><td>' +
                                    result.size + '</td></tr>');
                            break;
                        case 'Garmin Export':
                            $taskDiv.append('<tr><td><a href="' + result.url + '">Garmin Map (IMG) File</a></td><td>' + duration + '</td><td>' +
                                    result.size + '</td></tr>');
                            break;
                        case 'SQLITE Export':
                            $taskDiv.append('<tr><td><a href="' + result.url + '">SQlite Database File</a></td><td>' + duration + '</td><td>' +
                                    result.size + '</td></tr>');
                            break;
                    }
                });
            });
        }); 
      
    }
    
    /**
     * Gets a template for displaying completed run details.
     */
    function getCompletedRunTemplate(context) {
        var html = $('  <div class="panel panel-default"> \
                            <div class="panel-heading" role="tab"> \
                                <h4 class="panel-title"> \
                                    <a role="button" data-toggle="collapse" data-parent="#completed_runs" href="#{{ run_uid }}" \
                                        aria-expanded="true" aria-controls="{{ run_uid }}"> \
                                        {{ finished }} \
                                    </a> \
                                </h4> \
                            </div> \
                            <div id="{{ run_uid }}" class="panel-collapse collapse {{ expanded }}" role="tabpanel"> \
                                <div class="panel-body"> \
                                    <div class="row"> \
                                       <div class="col-md-12"> \
                                           <div class="table-responsive"> \
                                               <table class="table"> \
                                                   <tr><td><strong>Run Id:</strong></td><td><div id="runuid">{{ run_uid }}</div></td></tr> \
                                                   <tr><td><strong>Status:</strong></td><td><div id="status" class="{{ status_class }}" role="alert">{{ status }}</div></td></tr> \
                                                   <tr><td><strong>Started:</strong></td><td><div id="started">{{ started }}</div></td></tr> \
                                                   <tr><td><strong>Finished:</strong></td><td><div id="finished">{{ finished }}</div></td></tr> \
                                                   <tr><td><strong>Duration:</strong></td><td><div id="duration">{{ duration }}</div></td></tr> \
                                                   <tr><td><strong>Download:</strong></td><td> \
                                                        <div id="tasks"> \
                                                            <table class="table table-condensed" width="100%"> \
                                                            <thead><th>File</th><th>Duration</th><th>Size</th></thead> \
                                                            </table> \
                                                        </div> \
                                                    </td></tr> \
                                               </table> \
                                           </div> \
                                       </div> \
                                    </div> \
                                </div> \
                            </div> \
                        </div>').html();
        var template = Handlebars.compile(html);
        return template;
    }
    
    
    /**
      * Loads the job details.
      * This occurs initially on page load..
      */
    function loadSubmittedRunDetails(){
        var job_uid = exports.detail.job_uid;
        $.getJSON(Config.RUNS_URL + '?status=SUBMITTED&job_uid=' + job_uid, function(data){
            if (data.length > 0) {
                initSumtittedRunPanel(data);
                startRunCheckInterval();
            }
        }); 
    }
    
    /**
     * Initializes the submitted run panel.
     */
    function initSumtittedRunPanel(data){
        var $runPanel = $('#submitted_runs > .panel-group');
        $runPanel.empty();
        if (data.length > 0) {
            // display the submitted run
            $('#submitted_runs').css('display', 'block');
            // disable the re-run button..
            $('button#rerun').prop('disabled', 'true');
        }
        else {
            // stop the interval timer..
            clearInterval(exports.detail.timer);
            // hide the submitted run div
            $('#submitted_runs').css('display', 'none');
            // reload the completed runs to show the latest run..
            loadCompletedRunDetails();
            // enable the re-run button..
            $('button#rerun').prop('disabled', '');
            return;
        }
        $.each(data, function(index, run){
            var started = moment(run.started_at).format('h:mm:ss a, MMMM Do YYYY');
            var duration = moment.duration(run.duration).humanize();
            var status_class = run.status === 'SUBMITTED' ? 'alert alert-info' : 'alert alert-warning';
            var expanded = index === 0 ? 'in' : ''; // collapse all for now..
            var context = { 'run_uid': run.uid, 'status': run.status,
                            'started': started, 'status_class': status_class,
                            'expanded': expanded};
            var template = getSubmittedRunTemplate();
            var html = template(context);
            $runPanel.append(html);
            // add task info
            $taskDiv = $('div#' + run.uid).find('#tasks').find('table');
            var tasks = run.tasks;
            $.each(tasks, function(i, task){
                var result = task.result;
                var status = task.status;
                var duration = task.duration ? numeral(task.duration).format("HH:mm:ss.SSS") : ' -- '; 
                switch (task.name) {
                    case 'OverpassQuery':
                        if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td>Extract OpenStreetMap Data</td><td>' + duration + '</td><td> -- </td><td>' + task.status + '</td></tr>');
                        }
                        else {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td>Extract OpenStreetMap Data</td><td>' + duration + '</td><td>' + result.size + '</td><td>' + task.status + '</td></tr>');
                        }
                        break;
                    case 'KML Export':
                        if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td>Google Earth (KMZ)</td><td>' + duration + '</td><td> -- </td><td>' + task.status + '</td></tr>');
                        }
                        else {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td><a href="' + result.url + '">Google Earth (KMZ) File</a></td><td>' + duration + '</td><td>' +
                            result.size + '</td><td>' + task.status + '</td></tr>');
                        }
                        break;
                    case 'OSM2PBF':
                        if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td>OpenStreetMap (PBF) File</td><td>' + duration + '</td><td> -- </td><td>' + task.status + '</td></tr>');
                        }
                        else {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td><a href="' + result.url + '">OpenStreetMap (PBF) File</a></td><td>' + duration + '</td><td>' +
                            result.size + '</td><td>' + task.status + '</td></tr>');
                        }
                        break;
                    case 'Shapefile Export':
                        if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td>ESRI Shapefile (SHP)</td><td>' + duration + '</td><td> -- </td><td>' + task.status + '</td></tr>');
                        }
                        else {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td><a href="' + result.url + '">ESRI Shapefile (SHP)</a></td><td>' + duration + '</td><td>' +
                            result.size + '</td><td>' + task.status + '</td></tr>');
                        }
                        break;
                    case 'OBF Export':
                        if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td>OSMAnd (OBF) File</td><td> -- </td><td> -- </td><td>' + task.status + '</td></tr>');
                        }
                        else {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td><a href="' + result.url + '">OSMAnd (OBF) File</a></td><td>' + duration + '</td><td>' +
                            result.size + '</td><td>' + task.status + '</td></tr>');
                        }
                        break;
                    case 'Garmin Export':
                        if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td>Garamin Map (IMG) File</td><td> -- <td> -- </td><td>' + task.status + '</td></tr>');
                        }
                        else {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td><a href="' + result.url + '">Garmin Map (IMG) File</a></td><td>' + duration + '</td><td>' +
                            result.size + '</td><td>' + task.status + '</td></tr>');
                        }
                        break;
                    case 'SQLITE Export':
                        if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid + '"><td>SQlite Database File</td><td> -- </td><td> -- </td><td>' + task.status + '</td></tr>');
                        }
                        else {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td><a href="' + result.url + '">SQlite Database File</a></td><td>' + duration + '</td><td>' +
                            result.size + '</td><td>' + task.status + '</td></tr>');
                        }
                        break;
                    case 'OSMSchema':
                        if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td>Generate OpenStreetMap Schema</td><td> -- </td><td> -- </td><td>' + task.status + '</td></tr>');
                        }
                        else {
                            cls = status.toLowerCase();
                            $taskDiv.append('<tr class="' + cls + '" id="' + task.uid +'"><td>Generate OpenStreetMap Schema</td><td>' + duration + '</td><td></td><td>' + task.status + '</td></tr>');
                        }
                        break; 
                }
            });
        });
    }
    
    /**
     * Gets a template for displaying submitted run details.
     */
    function getSubmittedRunTemplate(context) {
        var html = $('  <div class="panel panel-default"> \
                            <!-- \
                            <div class="panel-heading" role="tab"> \
                                <h4 class="panel-title"> \
                                    <a role="button" data-toggle="collapse" data-parent="#submitted_runs" href="#{{ run_uid }}" \
                                        aria-expanded="true" aria-controls="{{ run_uid }}"> \
                                        {{ finished }} \
                                    </a> \
                                </h4> \
                            </div> \
                            --> \
                            <div id="{{ run_uid }}" class="panel-collapse collapse {{ expanded }}" role="tabpanel"> \
                                <div class="panel-body"> \
                                    <div class="row"> \
                                       <div class="col-md-12"> \
                                           <div class="table-responsive"> \
                                               <table class="table"> \
                                                   <tr><td><strong>Run Id:</strong></td><td><div id="runuid">{{ run_uid }}</div></td></tr> \
                                                   <tr><td><strong>Status:</strong></td><td><div id="status" class="{{ status_class }}" role="alert">{{ status }}</div></td></tr> \
                                                   <tr><td><strong>Started:</strong></td><td><div id="started">{{ started }}</div></td></tr> \
                                                   <tr><td><strong>Tasks:</strong></td><td> \
                                                        <div id="tasks"> \
                                                            <table class="table table-condensed" width="100%"> \
                                                            <thead><th>Name</th><th>Duration</th><th>Size</th><th>Status</th></thead> \
                                                            </table> \
                                                        </div> \
                                                    </td></tr> \
                                                    <tr><td></td></tr> \
                                               </table> \
                                           </div> \
                                       </div> \
                                   </div> \
                                </div> \
                            </div> \
                        </div>').html();
        var template = Handlebars.compile(html);
        return template;
    }
    
    /**
     * Updates the submitted run details to show task status.
     */
    function updateSubmittedRunDetails(){
        var job_uid = exports.detail.job_uid;
        $.getJSON(Config.RUNS_URL + '?status=SUBMITTED&job_uid=' + job_uid,
                  function(data){
            console.log(data);
            if (data.length > 0) {
                var run = data[0];
                var run_uid = run.uid;
                var $runDiv = $('#' + run_uid);
                var tasks = run.tasks;
                $.each(tasks, function(i, task){
                    var uid = task.uid;
                    var result = task.result;
                    var status = task.status;
                    var duration = task.duration ? numeral(task.duration).format("HH:mm:ss.SSS") : ' -- ';
                    var $tr = $runDiv.find('table').find('tr#' + uid);
                    switch (task.name) {
                        case 'OverpassQuery':
                            if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td>Extract OpenStreetMap Data</td><td> -- </td><td> -- </td><td>' + task.status + '</td>');
                            }
                            else {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td>Extract OpenStreetMap Data</td><td>' + duration + '</td><td>' + result.size + '</td><td>' + task.status + '</td>');
                            }
                            break;
                        case 'KML Export':
                            if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td>Google Earth (KMZ)</td><td> -- </td><td> -- </td><td>' + task.status + '</td>');
                            }
                            else {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td><a href="' + result.url + '">Google Earth (KMZ) File</a></td><td>' + duration + '</td><td>' +
                                result.size + '</td><td>' + task.status + '</td>');
                            }
                            break;
                        case 'OSM2PBF':
                            if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td>OpenStreetMap (PBF) File</td><td> -- </td><td> -- </td><td>' + task.status + '</td>');
                            }
                            else {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td><a href="' + result.url + '">OpenStreetMap (PBF) File</a></td><td>' + duration + '</td><td>' +
                                result.size + '</td><td>' + task.status + '</td>');
                            }
                            break;
                        case 'Shapefile Export':
                            if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td>ESRI Shapefile (SHP)</td><td> -- </td><td> -- </td><td>' + task.status + '</td>');
                            }
                            else {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td><a href="' + result.url + '">ESRI Shapefile (SHP)</a></td><td>' + duration + '</td><td>' +
                                result.size + '</td><td>' + task.status + '</td>');
                            }
                            break;
                        case 'OBF Export':
                            if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td>OSMAnd (OBF) File</td><td> -- </td><td> -- </td><td>' + task.status + '</td>');
                            }
                            else {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td><a href="' + result.url + '">OSMAnd (OBF) File</a></td><td>' + duration + '</td><td>' +
                                result.size + '</td><td>' + task.status + '</td>');
                            }
                            break;
                        case 'Garmin Export':
                            if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td>Garamin Map (IMG) File</td><td> -- </td><td> -- </td><td>' + task.status + '</td>');
                            }
                            else {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td><a href="' + result.url + '">Garmin Map (IMG) File</a></td><td>' + duration + '</td><td>' +
                                result.size + '</td><td>' + task.status + '</td>');
                            }
                            break;
                        case 'SQLITE Export':
                            if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td>SQlite Database File</td><td> -- </td><td> -- </td><td>' + task.status + '</td>');
                            }
                            else {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td><a href="' + result.url + '">SQlite Database File</a></td><td>' + duration + '</td><td>' +
                                result.size + '</td><td>' + task.status + '</td>');
                            }
                            break;
                        case 'OSMSchema':
                            if (status === 'PENDING' || status === 'RUNNING' || status === 'FAILED') {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td>Generate OpenStreetMap Schema</td><td> -- </td><td> -- </td><td>' + task.status + '</td>');
                            }
                            else {
                                $tr.removeClass();
                                $tr.addClass(status.toLowerCase());
                                $tr.html('<td>Generate OpenStreetMap Schema</td><td>' + duration + '</td><td> -- </td><td>' + task.status + '</td>');
                            }
                            break; 
                    }
                   
                });
            }
            else {
                // stop the interval timer..
                clearInterval(exports.detail.timer);
                exports.detail.timer = false;
                
                // reload the completed runs to show the latest run..
                loadCompletedRunDetails();
                
                // enable the re-run button..
                $('button#rerun').prop('disabled', '');
            }
        }); 
    }
    
    /*
     * Starts an interval timer to periodically
     * report the status of a currently running job.
     */
    function startRunCheckInterval(){
        var job_uid = exports.detail.job_uid;
        /*
         * Collapse the completed run panels before
         * updating the submitted run panel.
         * Only do this once before interval check kicks in.
         */
        if (!exports.detail.timer) {
            $('#completed_runs .panel-collapse').removeClass('in'); // fix this..
        }
        
        /*
         * Wait 2 seconds before
         * starting the interval timer to give
         * the api a chance to start the job..
         */
        setTimeout(function(){
            exports.detail.timer = setInterval(function(){
                updateSubmittedRunDetails();
            }, 3000);
        }, 2000);
    }
  
    
})();


$(document).ready(function() {
    // initialize the app..
    exports.detail.init();
});

