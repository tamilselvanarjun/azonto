function handleDrag(event) {
    event.stopPropagation();
    event.preventDefault();
    event.target.className = (event.type == "dragenter" ? "hover" : "");
}

function handleDragOver(event) {
    event.stopPropagation();
    event.preventDefault();
}

function handleFileDrop(event) {
    event.stopPropagation();
    event.preventDefault();

    event.target.className = "";
    var files = event.dataTransfer.files;
    handleFiles(files);
}

function handleFiles(files) {
    var file = files[0];
    //TODO: check that filetype is valid mp3
    var reader = new FileReader();
    reader.onload = handleReaderLoad;
    reader.readAsArrayBuffer(file);
}

function handleReaderLoad(event) {
    var arrbuff = event.target.result;
    console.log(arrbuff);
    //send to other people in this room with webrtc
}

$(document).ready(function () {
  // TODO: Add code here
	if (!(window.File && window.FileReader)) {
		$('#unsupported').show();
	}

	var dragRegion = document.getElementById('dragregion');
	dragRegion.addEventListener('dragenter', handleDrag, false);
	dragRegion.addEventListener('dragover', handleDragOver, false);
	dragRegion.addEventListener('dragleave', handleDrag, false);
	dragRegion.addEventListener('drop', handleFileDrop, false);
})