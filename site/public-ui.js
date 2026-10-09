// Public browsing never loads the service-request submission code.
document.querySelectorAll('.service-category').forEach(category=>{
 const action=category.querySelector('.home-category-action');if(!action)return;
 const update=()=>{action.textContent=category.open?'Press or click to close':'Press or click to see jobs';};
 category.addEventListener('toggle',update);update();
});
