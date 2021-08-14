$(document).ready(function () {
    const inputs = Array.from(document.querySelectorAll('input'))
    inputs.map(async (input)=>{
        let name = input.getAttribute('name');
        let value = await Controls.getLocalStorage(name)
        input.setAttribute('value', value);
    })

    document.addEventListener('change', function (event){
        let name = event.target.getAttribute('name');
        Controls.setLocalStorage(name, event.target.value)

    })
});