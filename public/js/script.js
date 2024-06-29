function displayModalById(modalId){
    var modal = document.getElementById(modalId);
    var closeBtn = modal.getElementsByClassName("close")[0];
    modal.style.display = "block";
    window.onclick = function(event){
        if(event.target == modal){
            modal.style.display = "none";
        }
    }
    closeBtn.onclick = function(event){
        modal.style.display = "none";
    }
}